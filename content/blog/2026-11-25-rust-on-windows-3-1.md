---
title: "Cross-compiling to the past, part 2: Rust on Windows 3.1"
date: "2026-11-25"
slug: "rust-on-windows-3-1"
excerpt: "A Rust program can ask Windows 3.1 for a real message box. Getting there took LLVM's code16 mode, a hand-built NE executable and import shims, and then a hunt for a crash that turned out to be a stack pointer the CPU only half restores."
tags:
  - "Cross-compilation"
  - "Rust"
  - "Windows 3.1"
  - "Win16"
  - "Liminal Installer"
draft: true
---

> **In this series: Cross-compiling to the past.** One portable Rust core, built on a modern Linux PC, carried to three old platforms. Quill, a small word processor built the same way, turns up along the way.
>
> 1. [Rust on DOS](/blog/rust-on-dos): a floppy-disk question, a 32-bit protected-mode runtime, and a Rust pipeline from Linux to DOS.
> 2. **Rust on Windows 3.1** (this post): 16-bit code, a hand-built NE executable, and a crash that arrives with the timer.
> 3. [Rust on Windows 95, 98 and Me](/blog/rust-on-windows-9x): why "any Win32 program" doesn't include Rust's, and what it takes to change that.

Eventually I realised I needed an installer. If I was going to make one, I wanted it to target the platforms the game already supported, and then I started wondering whether I could fill in some of the gaps.

The installer itself is generic: the same engine could install someone else's game, a utility or another kind of product altogether. Unpacking files and writing an install receipt were already handled by its portable core. What Windows 3.1 needed was a face: a 16-bit Windows application, written in Rust, with Windows itself drawing the title bar, the borders and the **OK** button.

The AI agent and I had been asking whether we could actually get Rust code running as a 16-bit Windows 3.1 application. Rust mostly targets 32-bit systems and newer, so I was curious what LLVM could produce, and whether a shim could carry the idea the rest of the way. Then there was a screenshot:

![Program Manager on Windows for Workgroups 3.11 with a message box reading "Hello from Rust, in 16-bit Windows"](/blog/rust-on-windows-3-1/wfw311-hello.png)
*`HELLO.EXE` on Windows for Workgroups 3.11 in DOSBox-X. After this box it opens a window, paints it with `TextOut` and runs a three-page wizard from its resources.*

Seeing it was really cool. Windows had drawn the box and supplied the controls, and a Rust program had asked for them through the native 16-bit Windows API. That little dialog meant the idea had gone far enough for other people to learn from it: someone else could look at what it took and make their own 16-bit Windows program.

The installer's design notes weigh two other routes. Win32s, Microsoft's add-on that let some 32-bit programs run on Windows 3.1, would have to be installed before our installer could run, which defeats the point.

Open Watcom C builds real 16-bit Windows programs today, but it can't share a line with the installer's Rust core, so every fix would happen twice. Rust won, with Open Watcom kept as the reference and the fallback. This post explains how that works, and then why the first real installer built this way crashed now and then.

## What Windows 3.1 expects from a program

Picture a PC from 1992: a 386, a few megabytes of memory, a VGA screen and DOS on the hard disk. Windows 3.1 starts from the DOS prompt when you type `WIN` and takes over the screen with Program Manager. Programs share the machine by taking turns, each handling a message and then handing control back.

It runs in two modes. Standard mode works on a 286. 386 Enhanced mode needs a 386 and gives each DOS window a virtual machine of its own. Windows for Workgroups 3.11, the version tested here, runs only in 386 Enhanced mode, and the Rust programs need a 386 too, for a reason the next sections explain.

A Windows 3.x program is an **NE** file, for New Executable. It starts with a small DOS program that prints "This program requires Microsoft Windows" if you run it from DOS. After that come tables describing **segments**, separate pieces of code and data of at most 64 KiB each, which Windows reaches through **selectors** it assigns only when it loads the program. A linked program doesn't know its own selectors, and it certainly doesn't know where `USER.EXE` will put `MessageBox`.

So every call into Windows is a **far call**, one that names a segment as well as an offset, and the file lists **fixups** telling the loader which bytes to patch with real addresses. Windows 3.1 also uses the **Pascal** calling convention: arguments are pushed left to right as 16-bit words, the function being called cleans them up, and functions are imported by number (`MessageBox` is `USER.1`, and the start-up call `INITTASK` is `KERNEL.91`).

Think of a segment as a furnished room. The analogy holds for the 64 KiB size limit and for the loader moving furniture in at start-up, and it breaks at the walls: on a 386 the walls are enforced by hardware, and reading a single byte past the end stops the program with a General Protection Fault, Windows 3.x's message for a program that touched memory it doesn't own. Hold on to that image, because it's how the worst bug in this post works.

## How 32-bit Rust emits 16-bit code

Rust and LLVM expect 32-bit or 64-bit registers and pointers, and nobody maintains a 16-bit Windows target for either. LLVM does carry one niche target, built for x86 bootloaders, which also start life in 16-bit mode. Here are four fields of the target specification the toolchain uses:

```json
{
  "llvm-target": "i386-unknown-none-code16",
  "cpu": "i386",
  "features": "-mmx,-sse,-sse2,-sse3,-ssse3,-sse4.1,-sse4.2,-avx,-x87",
  "rustc-abi": "softfloat"
}
```

`code16` emits instructions meant to run in a 16-bit code segment, while keeping most operations 32-bit by attaching one-byte prefixes (`66h` for a 32-bit operand, `67h` for a 32-bit address), which a 386 honours inside a 16-bit segment. Floating point is done in software, so a 386 without a maths coprocessor is fine. Here's a slice of the smallest program, disassembled as 16-bit code:

```text
  ab:   66 6a 00              pushd  0x0
  bd:   66 e8 91 ff ff ff     calld  54 <MessageBox>
  c3:   66 83 c4 10           add    esp,0x10
  d2:   67 66 8b 74 24 14     mov    esi,DWORD PTR [esp+0x14]
```

Two details in those four lines matter later. Calls between Rust functions are 32-bit near calls that stay inside one segment, which sets a 64 KiB ceiling on code. And every stack access uses all 32 bits of `ESP`, the stack pointer, which is going to collide head-on with Windows 3.11's timer.

The prefixes also set the hardware floor. A 286 has no 32-bit registers, so it's out for good. Everything here targets a 386 in Enhanced mode; Standard mode on a 386 should execute the prefixes, but I haven't tested it.

## Following one call to MessageBox

The whole program behind the smallest working Windows 3.1 executable is one function. A small runtime's `_start` calls `INITTASK` as its very first instruction, then `WaitEvent` and `InitApp`, and then this:

```rust
#[unsafe(no_mangle)]
pub extern "C" fn w16_main(_hinst: u32, _hprev: u32, _show: u32) -> u32 {
	unsafe { MessageBox(0, cs!("Hello from Rust"), cs!("Win16"), MB_OK) };
	0
}
```

`MessageBox` here is a generated shim. To cross from Rust into `USER.1`, a build script reads a compact import table, `tools/imports.tbl`, whose ordinals and argument counts come from Wine's 16-bit `.spec` files:

```text
KERNEL 15 GlobalAlloc wl w
USER 1 MessageBox wppw w
USER 87 DialogBox wlwf w
```

Each letter is one argument: `w` a word, `l` a long, `p` a data pointer, `f` a code pointer. The generator writes a small assembly shim per row that turns Rust's 32-bit values into Pascal words and far pointers, makes the far call, and puts the CPU's state back when Windows returns.

Linking needed one vintage trick. In an NE file both the code and the data segment start at offset 0, so `rust-lld` refuses with `virtual address range overlaps`. An `OVERLAY` in the linker script, a feature from the days when programs swapped parts of themselves through the same memory, gives both address 0 and keeps the first 16 bytes of data free for Windows' own bookkeeping.

> **The overlay, trimmed.** This is the single-segment version of the script; the multi-segment packer described later places code itself.
>
> ```text
> OVERLAY 0 : AT(0x1000) {
>   .text { *(.text.start) *(.text .text.*) }
>   .data {
>     KEEP(*(.data.00_reserved))
>     *(.rodata .rodata.*) *(.data .data.*) *(.bss .bss.*)
>   }
> }
> ```

Finally, `ne_pack.py` turns the linked ELF file into a real NE file: the DOS stub, the NE header, the segment table, the module names, any resources, and a relocation record for every far call.

![Byte layout of MSGBOX.EXE: a DOS stub, the NE header and tables, a 261-byte code segment with four far-call sites, four relocation records pointing back at them, and a 44-byte data segment](/blog/rust-on-windows-3-1/msgbox-ne-layout.svg)
*The whole of `MSGBOX.EXE`, 620 bytes. The four orange bands are the far calls the loader patches, listed in file order. The `HELLO.EXE` in the screenshot above has the same shape with a longer string.*

Open Watcom C builds the same message box in 1,478 bytes by default, or 1,250 built for size. That's a fun comparison and an unfair one, since Watcom's program runs on a 286 and ours needs a 386.

> **Six bugs that looked right until Windows 3.11 ran them.** Wine 11.21 still runs 16-bit programs and gave a fast inner loop, while Windows for Workgroups 3.11 in DOSBox-X enforced the real rules. Each of these looked right on paper or under Wine:
>
> 1. "Insufficient memory to run this application." The loader walks a chain of fixups ended by `0xFFFF`, and zeros at the call sites led the chain back to offset 0.
> 2. A message box reading "Hello P omÅ". Windows keeps its bookkeeping in the first 16 bytes of the data segment, right where the first string had been.
> 3. Death inside `INITTASK`. One instruction before it changed a register `INITTASK` reads.
> 4. A dialog that never opened. NE resource lengths count alignment units, and the last resource came up a few bytes short.
> 5. A General Protection Fault in `rep movsb`. Windows doesn't preserve the ES register, and Rust's block copies use it, so every shim now reloads it.
> 6. `_lcreat` failing after a `mkdir`. The DOS call that made the directory changed registers the compiler thought were safe.
>
> With those fixed, a 14,944-byte installer proof ran on Windows for Workgroups 3.11, on Wine, and on Windows Me, which reports itself to 16-bit programs as Windows 3.95.

## Why a wizard breaks what a message box hides

A message box spends nearly its whole life asleep inside Windows, waiting for a click. An installer spends milliseconds at a time inside Rust between API calls, decoding the project, running the install steps and unpacking compressed files.

![A Windows 3.11 dialog titled Software License Agreement, with a scrolling licence, accept and decline buttons, and Back, Next and Cancel](/blog/rust-on-windows-3-1/uidemo-licence.png)
*The installer's licence page on Windows for Workgroups 3.11 in DOSBox-X: real Windows controls, laid out from the same compiled project the DOS installer reads.*

A **register** is one of the CPU's few named scratch slots, 32 bits wide on a 386, and 16-bit Windows was written to know only about the low halves. A 16-bit Windows function promises to preserve only SI, DI, BP and DS, while Rust keeps live values in the full EBX, ESI, EDI and EBP. Quill, the word processor from the series box, ran a two-task version of the register probe the installer's spike had started, with two copies side by side. It showed the high halves leaking:

```text
GetVersion=05000A03 GetWinFlags=00000C29 386 Enhanced mode
probe PeekMessage: EBX=55550000 ESI=6666BE02 EDI=7777BE03 EBP=8888BE04 ESP=800144AA ... CLOBBERED
probe Yield via stub: EBX=1111BE01 ESI=2222BE02 EDI=3333BE03 EBP=4444BE04 ESP=000044D2 ... PRESERVED
```

The first copy had loaded `2222BE02` into ESI and got `6666BE02` back. The high half belonged to the other copy, which had run in the meantime. Across 326,235 rounds, raw calls changed the second copy's registers 150,316 times, and calls through the register-saving shims changed them zero times. Wine keeps the high halves intact, which is why Wine could never have caught this.

Every shim now saves the full EBX, ESI, EDI and EBP, and clears the top half of ESP with `movzx esp, sp` after each call. That looked like the end of it.

## The crashes that moved around

The installer itself was too big for one 64 KiB code segment, so at first it was built as two halves that fit, `ENGINE.EXE` for installing and uninstalling and `UIDEMO.EXE` for the pages, and run on Windows for Workgroups 3.11 under DOSBox-X. Both ran. Both also died now and then. Of the last ten runs of `ENGINE.EXE`, five installs and five uninstalls, four ended in a General Protection Fault or a "Rust panic" box, each time somewhere new.

A crash that moves around is the worst kind to chase. Zeroing the memory Windows hands out without clearing it helped: failures dropped from about 2 in 5 to about 1 in 6, though the notes don't keep the run counts behind those figures. Then a bigger build brought them back to 4 in 10.

In Quill's probe, a four-way `match` compiled to a jump table that leapt to `0001:11D0`, in the middle of a `call` instruction, and turning jump tables off didn't stop the crashes either. `11D0` is also the Program Manager window handle that Quill's probe log prints (`FindWindow Progman: 11D0`). That suggests the table had been written over rather than built wrong, though it was never confirmed.

## The clue was ESP going dirty about twenty times a second

Every General Protection Fault had one thing in common: it hit a `rep movs` copying a value whose address was built from the stack pointer, such as `lea esi, [esp+x]`. And an early probe line had shown `ESP=800144AA`, a stack pointer with something in its top half.

So we wrote a probe that loops in assembly, touches no stack memory, makes no Windows calls, and checks the top 16 bits of ESP on every pass. In 6.3 seconds it caught ESP above `0xFFFF` 130 times, always `8001xxxx`. That's 20.6 times a second, close to the PC's standard 18.2 Hz timer; I don't know where the difference comes from.

![A timeline: a shim clears ESP after a Windows call, Rust reads the stack safely, a timer tick leaves 8001 in the high half of ESP, and the next stack read faults past the end of the segment](/blog/rust-on-windows-3-1/esp-timeline.svg)
*How a timer tick breaks a stack read. The ESP values follow the probe's pattern.*

When an interrupt finishes on a 386 and returns to a 16-bit stack segment, the CPU restores only the 16-bit SP. The top half of ESP keeps whatever the system code left there, which in Windows 3.11's Enhanced mode is `8001`. Because code16 addresses the stack through all 32 bits of ESP, the next stack read asks for an offset about 2 GiB past the end of a 64 KiB segment, one step through the wall of the room.

The hardware stops it. That also explained why short stretches of Rust survived: every shim ran `movzx esp, sp` on the way back from Windows and wiped the dirt, while any few milliseconds of decoding or unpacking with no API call in between was likely to meet a tick.

> **Two fixes that failed before the right one.**
>
> - Hooking the timer interrupts (INT 08h and INT 1Ch) to clean ESP in handlers of our own changed nothing: the counts were 129 and 133. The dirt is made after those handlers have run.
> - Marking the task's whole stack 32-bit through DPMI took the count to zero and let installs complete. Uninstalls then faulted inside Windows' own `KRNL386` in 3 runs out of 3, because Windows' 16-bit kernel code now ran on a stack it was never written for.

## The fix gives one stack two selectors

Each side had a fair expectation about the stack it stood on, so the fix gives the CPU two selectors for the same stack memory:

1. At start-up, `_start` asks DPMI, the protected-mode services Windows provides in Enhanced mode, for a second selector over the task's stack, marked 32-bit. Rust runs on that alias, so the 386 restores all 32 bits of ESP after every interrupt.
2. Each import shim switches back to Windows' original 16-bit stack selector right before its far call, and to the alias right after, moving the alias if Windows has moved the data segment in the meantime. Windows only ever runs on the stack it gave the task.

In a test loop of 4 million iterations inside `BIGSEG.EXE`, described below, ESP went dirty 4 to 7 times on the 16-bit stack and never on the alias.

## The packer breaks the 64 KiB wall

The other wall was code size. Because code16 only emits near calls, every Rust function had to fit in one 65,536-byte code segment with everything that calls it. The whole installer runtime first came to 121,725 bytes of code. A hand-written project decoder in place of `serde`'s generated one, a plain vector in place of a `BTreeMap` and no sorting at run time took it to 97,265, and the same change shrank the other runtimes too:

| Runtime | Before | After | Measured as |
|---|---|---|---|
| Windows 3.1 | 121,725 | 97,265 | bytes of code |
| DOS `SETUP.EXE` | 153,088 | 136,704 | bytes of file |
| Windows 95 `SETUP.EXE` | 135,680 | 115,200 | bytes of file |

That still wasn't enough. To remove the wall, the NE packer now places functions in several code segments itself, an approach Quill prototyped first and the shared toolchain took over. A call that crosses segments goes through a small far-jump veneer in the caller's segment. Tail calls and calls through function pointers go through a shadow return stack, and every function whose address is taken gets a slot at the same offset in every segment, so a pointer means the same function wherever it's called.

Segments can even be discarded under memory pressure and reloaded on demand, through a gate that moves to the 16-bit stack while Windows does the reloading. The limits are 253 code segments and a 1 MB file, and no single function may be bigger than one segment.

To prove both fixes together, there's `BIGSEG.EXE`: 88 KB of Rust code across five segments, with segment 3 discarded and reloaded on every run, jump tables turned back on, and every result checked against a second implementation. On Windows for Workgroups 3.11 in DOSBox-X it passed 40 runs out of 40 with the stack alias on. With the alias off, the same program gave wrong results in 3 runs out of 20, about 1 in 7, close to the installer's earlier 1 in 6. The stack code costs a little: the smallest program, `MSGBOX.EXE`, grew from 620 to 948 bytes.

## The whole installer now runs as one program

With both walls down, the installer's Windows 3.1 `SETUP.EXE` links as one program again: 138,827 bytes of code in four segments, in a 206,179-byte file. It installs and uninstalls Lieutenant Fizz and Planboard through its real controls under Wine, and on Windows for Workgroups 3.11 in DOSBox-X. There, 40 runs passed out of 40, 20 for each example, with each install and each uninstall in a fresh DOSBox-X session, the pages equal to the host's goldens, the receipt's sizes matching and the folder gone afterwards.

![A Windows 3.11 dialog titled Setup Complete: setup has finished installing Lieutenant Fizz Episode One, with a Launch Lieutenant Fizz check box and a Finish button](/blog/rust-on-windows-3-1/setup-done.png)
*The last page of the whole `SETUP.EXE` on Windows for Workgroups 3.11 in DOSBox-X.*

## Limits and what hasn't been tested

- Only DOSBox-X and Wine have run the installer. Since the cause of the crash is how a 386 returns to a 16-bit stack, I expect real hardware to behave the same, but no real 386 or 486 and no other emulator has run it.
- Only Windows for Workgroups 3.11 has run it. Retail Windows 3.1 hasn't been tried in either mode, and Windows Me hasn't run the stack-alias build.
- No 286 and no Standard mode. Windows for Workgroups 3.11 refuses `WIN /S`.
- No Program Manager group. Making one through a DDE conversation with Program Manager is still unbuilt.
- The multi-segment packer and the stack alias are in an open pull request on rust-win16, and the installer's Windows 3.1 runtime, with the "after" sizes in the table, is on a branch that isn't merged yet.

## Try it

The Windows 3.x toolchain and its examples (`msgbox`, `hello`, a small installer and `bigseg`) live in [liminal-hq-labs/rust-win16](https://github.com/liminal-hq-labs/rust-win16), and the installer's Windows 3.1 runtime is in `retro/win16/` of [liminal-hq-labs/liminal-installer](https://github.com/liminal-hq-labs/liminal-installer). You need `rustup` with `rust-src` and Python 3, and Wine is the fastest check before booting Windows 3.11 in DOSBox-X.

## Credits

**Wine** supplied every ordinal in `imports.tbl` and the fast half of the test loop. **Open Watcom** was the reference for the NE format, header by header, and remains the fallback. **DOSBox-X** ran Windows for Workgroups 3.11 faithfully enough to reproduce every bug in this post, timer ticks included.

## Next

The bet held, as far as DOSBox-X and Wine can show: Rust can speak 16-bit Windows 3.1, given a 32-bit stack alias and a packer that bridges 64 KiB segments.

If you want your own 16-bit Windows program, start where this post did. rust-win16's `msgbox` example is the single `w16_main` function shown above, and Windows will draw the box for you.

In [Part 3](/blog/rust-on-windows-9x), the series climbs back up to 32 bits for Windows 95, 98 and Me, where Rust already has an official Windows target, and a plain hello world still won't start.
