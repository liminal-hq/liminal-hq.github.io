---
title: "Cross-compiling to the past, part 2: Rust on Windows 3.1"
date: "2026-11-25"
slug: "rust-on-windows-3-1"
excerpt: "Rust can build real 16-bit Windows programs with LLVM's code16 mode, rust-lld and a home-made NE packer. On Windows for Workgroups 3.11 the installer engine still faults in four runs out of ten, and the trail leads to a register that changes twenty times a second."
tags:
  - "Cross-compilation"
  - "Rust"
  - "Windows 3.1"
  - "Win16"
  - "Liminal Installer"
draft: true
---

> **In this series: Cross-compiling to the past**
>
> 1. [Rust on DOS](/blog/rust-on-dos): a 32-bit protected-mode runtime, a packer, and a DOS installer.
> 2. **Rust on Windows 3.1** (this post): 16-bit code, a hand-built NE executable, and a crash that arrives with the timer.
> 3. [Rust on Windows 95, 98 and Me](/blog/rust-on-windows-9x): why "any Win32 program" doesn't include Rust's, and what it takes to change that.

Four of the last ten runs died. The program was `ENGINE.EXE`, the install engine of the [Liminal Installer](https://github.com/liminal-hq-labs/liminal-installer) built as a 16-bit Windows program in Rust, and on Windows for Workgroups 3.11 it installed and uninstalled Lieutenant Fizz byte for byte when it ran to the end. The other times it stopped with a General Protection Fault, a "Rust panic" box, or a fault deep inside Windows' own `KRNL386`, each time somewhere new.

![A Windows 3.11 dialog titled Software License Agreement, with an example licence in a scrolling box, accept and decline radio buttons, and Back, Next and Cancel buttons](/blog/rust-on-windows-3-1/uidemo-licence.png)
*The installer's licence page on Windows for Workgroups 3.11 in DOSBox-X: real Windows controls, laid out from the same compiled project the DOS installer reads.*

A crash that moves around is the worst kind to chase, and this one took a series of probe programs to pin down. This post follows that trail. On the way it covers how a 2026 Rust compiler produces a Windows 3.1 program at all, because the crash turned out to live in exactly that trick.

## Why the installer's Windows 3.1 runtime is Rust at all

[Part 1](/blog/rust-on-dos) got Rust onto DOS in 32-bit protected mode, where memory is flat and a pointer is a number. The installer's DOS runtime runs a portable core called `li-retro`, and I wanted Windows 3.1 to run the same core rather than a second installer written in another language.

There were two obvious alternatives. Win32s, Microsoft's add-on that let some 32-bit programs run on Windows 3.1, would need installing before our installer could run, which defeats the point. Open Watcom C builds real 16-bit Windows programs today, but it shares no code with the Rust core. So the installer's decision log (D46) chose Rust and kept Open Watcom as the fallback, and this post is partly about whether that bet holds.

## A Windows 3.1 program lives in 64 KiB rooms that the loader furnishes

A Windows 3.x executable is an **NE** file, for New Executable. Its code and data live in **segments** of at most 64 KiB each, and a program reaches a segment through a selector that Windows hands out when it loads the file. A program doesn't know its own selectors when it's linked, and it certainly doesn't know where `USER.EXE` will put `MessageBox`.

So every call into Windows is a far call whose target the loader writes into the code at load time. NE calls these patches **fixups**. Windows functions also use the **Pascal** calling convention: arguments go on the stack left to right as 16-bit words, and the function being called cleans them up. Functions are imported by number, so `MessageBox` is `USER.1`, and the first call every Windows program makes, `INITTASK`, is `KERNEL.91`.

Think of a segment as a furnished room. The analogy holds for the size limit and for the loader moving furniture in, and it breaks at the walls: on a 386 the walls are enforced by hardware, and a read one byte past them stops the program. Hold on to that, because it's how the crash works.

## LLVM writes 16-bit code by mostly writing 32-bit code

LLVM has a mode for one niche, x86 boot code. The target `i386-unknown-none-code16` emits code for a 16-bit segment, and the trick is that most instructions are still 32-bit ones carrying a prefix (`66h` for operand size, `67h` for address size) that a 386 honours in a 16-bit segment. The target spec, `win16.json`, is a close cousin of Part 1's, with software floating point so a 386 without a maths coprocessor is fine.

Here's a slice of the smallest program, disassembled as 16-bit code:

```text
  ab:   66 6a 00              pushd  0x0
  bd:   66 e8 91 ff ff ff     calld  54 <MessageBox>
  c3:   66 83 c4 10           add    esp,0x10
  d2:   67 66 8b 74 24 14     mov    esi,DWORD PTR [esp+0x14]
```

Every call between Rust functions is a 32-bit near call, and every stack access goes through ESP, all 32 bits of it. Both facts come back later: the first limits how big a program can be, and the second is the crash.

The prefixes also set the hardware floor before anything runs. A 286 has no 32-bit registers, so this code needs a 386, which rules out Windows 3.1's Standard mode on a 286 and leaves 386 Enhanced mode and everything later.

## The packer writes down every gap for the loader to fill

The linker turned out to be the awkward part. In an NE file the code and data segments each start at offset 0, so `.text` and `.data` must both be linked at address 0, and `rust-lld` refuses: `virtual address range overlaps`. The way around it is an `OVERLAY` in the linker script, a feature from the days when programs swapped parts of themselves through the same memory.

Calls into Windows go through generated stubs. `tools/imports.tbl` has a row per function with its ordinal and a tiny signature, and the ordinals and argument counts come from Wine's `.spec` files for the 16-bit system DLLs:

```text
KERNEL 15 GlobalAlloc wl w
USER 1 MessageBox wppw w
USER 87 DialogBox wlwf w
```

Each letter is one argument: `w` a word, `l` a long, `p` a data pointer, `f` a code pointer. From each row the generator writes a stub that converts Rust's 32-bit arguments into Pascal words and far pointers, makes the far call, and repairs the registers afterwards. That repair work is where this story ends up.

The packer, `ne_pack.py`, then turns the linked ELF file into an NE executable. Part 1's DOS packer had nothing to resolve, because `rust-lld` had fixed every address. On Windows nothing is fixed until load time, so this packer describes every gap: one fixup per import, entry records for window procedures, name tables and resources such as dialogs.

![Byte layout of MSGBOX.EXE: MZ stub at 0x000, NE header at 0x080, segment table at 0x0C0, name tables at 0x0D0, the 261-byte code segment at 0x110 with four far-call sites, four relocation records at 0x215 pointing back at those sites, and the 44-byte data segment at 0x240](/blog/rust-on-windows-3-1/msgbox-ne-layout.svg)
*The whole of `MSGBOX.EXE`, 620 bytes. The four orange bands are the far calls the loader patches.*

The program behind that layout is all of this:

```rust
#[unsafe(no_mangle)]
pub extern "C" fn w16_main(_hinst: u32, _hprev: u32, _show: u32) -> u32 {
	unsafe { MessageBox(0, cs!("Hello from Rust"), cs!("Win16"), MB_OK) };
	0
}
```

The same message box in C, built with Open Watcom, is 1,478 bytes, mostly start-up and stack-checking code. That's a fun comparison and an unfair one, since Open Watcom's code runs on a 286 and ours doesn't.

![Program Manager on Windows for Workgroups 3.11 with a message box titled Liminal reading "Hello from Rust, in 16-bit Windows" and an OK button](/blog/rust-on-windows-3-1/wfw311-hello.png)
*`HELLO.EXE` on Windows for Workgroups 3.11. After this box it opens a window, paints it with `TextOut` and runs a three-page wizard from its resources.*

## Six bugs passed on Wine and failed on Windows

I tested on Wine 11.21, which still runs 16-bit programs, and on Windows for Workgroups 3.11 in DOSBox-X. Wine was the fast loop. It was also the polite one, and six problems sailed through it before Windows 3.11 caught them:

1. "Insufficient memory to run this application." The loader follows a chain of fixups through the bytes it's about to patch, and `0xFFFF` ends the chain. The linker had left zeros there, so the chain led to offset 0. The packer now writes `0xFFFF` into every call site.
2. A message box reading "Hello P omÅ". Windows keeps its own bookkeeping in the first 16 bytes of the data segment, and the program's first string sat right there. The linker script now reserves them.
3. The task died inside `INITTASK`, because one instruction ran before it that changed a register `INITTASK` reads.
4. A dialog that never opened, because NE resource lengths count alignment units, and the last resource was a few bytes short.
5. A General Protection Fault in `rep movsb`. Windows doesn't preserve the ES register, and Rust's block copies use it, so the stubs reload it after every call.
6. `_lcreat` failing after a `mkdir`, because the DOS call that made the directory clobbered registers the compiler thought were safe.

Each was found the slow way: build, copy, boot Windows, look, think. With those fixed, the spike's 14,944-byte installer proof ran on Windows for Workgroups 3.11, on Windows Me and on Wine, and installed its file correctly.

## Windows changes registers it promised nothing about

Bug 5 raised a wider question. A 16-bit Windows function owes its caller only the 16-bit registers SI, DI, BP and DS. It makes no promise about the high halves of the 32-bit registers, and Rust keeps live values in EBX, ESI and EDI across calls.

Quill, a small word processor being built for DOS and early Windows on the same toolchain, ran the careful version of that experiment. Its probe fills the registers with patterns, makes raw API calls with no protective stub, and logs what comes back, while a second copy of the program runs alongside. The log from Windows for Workgroups 3.11:

```text
GetVersion=05000A03 GetWinFlags=00000C29 386 Enhanced mode
probe PeekMessage: EBX=55550000 ESI=6666BE02 EDI=7777BE03 EBP=8888BE04 ESP=800144AA ... CLOBBERED
probe Yield via stub: EBX=1111BE01 ESI=2222BE02 EDI=3333BE03 EBP=4444BE04 ESP=000044D2 ... PRESERVED
```

The task loaded `2222BE02` into ESI and got `6666BE02` back. The low half was restored, but the high half belonged to the other task, which had run in the meantime. Across 326,235 rounds, raw calls changed the second task's registers 150,316 times, and calls through the stubs changed them zero times.

So every stub now saves EBX, ESI, EDI and EBP at full width, and so does the wrapper for window procedures that Windows calls. Note the other detail in that first line: ESP came back with `8001` in its high half. Quill's notes read that as harmless, since the stubs clear it with `movzx esp, sp`. That reading was right for Quill's probe and wrong for the installer.

## The faults came back when the program grew

The installer's whole Windows 3.1 runtime doesn't fit in one code segment (more on that below), so it was built as two halves that do: `ENGINE.EXE`, which installs and uninstalls from the pack, and `UIDEMO.EXE`, which shows the pages. Both ran. Both also died now and then, in different places.

One early suspect was memory. Windows 3.11 doesn't zero the part of a segment past its length in the file, or the unused stack, so the program's entry code now clears both. The failure rate fell from about 2 in 5 to about 1 in 6. Then the build grew, and it climbed back to 4 in 10.

Another was jump tables. In Quill's probe, a four-way `match` compiled to `jmp [ebx*4+0x10]`, and the jump landed in the middle of a `call` instruction, which Windows reported as an illegal instruction. Nobody has explained that one yet. Jump tables are off in both projects (`-C jump-tables=no`, about 1 KB of code), and the faults carried on.

## The clue was ESP changing twenty times a second

The faults had one thing in common. The General Protection Faults hit a `rep movs` copying a value whose address came from `lea esi, [esp+x]`, an address built from the stack pointer.

So I wrote a probe that does nothing but loop in assembly, touching no stack memory, and checks the high half of ESP on every pass. In 6.3 seconds it found ESP above `0xFFFF` 130 times, always `8001xxxx`, about 20 times a second, cleaning it each time. That's the timer's pace. Something in 386 Enhanced mode, after a tick, hands the task back with a dirty ESP.

![A timeline: a stub clears ESP after a Windows call, Rust reads the stack through ESP safely, a timer tick leaves 8001 in the high half of ESP, and the next stack read faults about 2 GiB past the end of the segment](/blog/rust-on-windows-3-1/esp-timeline.svg)
*The mechanism, as the probes measured it. The ESP values follow the probe's pattern; the tick rate is from DOSBox-X.*

Now the earlier facts click together. code16 addresses the stack through all 32 bits of ESP, so the first stack read after a tick asks for an offset about 2 GiB past the end of a 64 KiB segment, and the hardware stops it.

Each Windows call ends in a stub that cleans ESP, which is why short stretches of Rust survive. A stretch of a few milliseconds with no API call, such as decoding the project or inflating a chunk of the pack, is likely to meet a tick. The bigger build had more of those stretches.

> **What didn't fix it.** Hooking the timer interrupts (INT 08h and INT 1Ch) to clean ESP changed nothing: the counts were 129 and 133, because the dirt is made after the handlers run, where a task can't reach. A frame pointer copies the dirt into EBP. A 32-bit stack (SS made an alias of DS with the "big" bit set through DPMI function `0009h`) took the count to zero and let installs run, but uninstalls then faulted inside `KRNL386` in 3 runs out of 3, and the fault moved when the code's layout changed.

## What the evidence doesn't say yet

The installer's decision log records this as D74, and it ends with "not solved". The options, in the order I plan to try them: find where the dirt is made with DOSBox-X's debugger, and whether a 32-bit stack plus some care around KERNEL's own stack use closes it; have the packer rewrite stack accesses to 16-bit `[bp+x]` addressing, which ignores the high half; keep computations short enough to end in an API call; or fall back to Open Watcom C, whose 16-bit code never touches ESP.

I don't know whether a real 386 or 486 running Windows 3.11 does the same thing. Every measurement here comes from DOSBox-X 2025.02.01, and an emulator is allowed to differ from silicon in exactly this sort of corner. Until a real machine runs the probe, "Windows 3.11 dirties ESP" really means "Windows 3.11 in DOSBox-X does".

## The other wall is 64 KiB of code

The crash isn't the only problem. LLVM's code16 mode emits only near calls (`66 E8` and a 32-bit offset). It can't emit a far call, so every function must sit in the same 64 KiB code segment as everything that calls it.

The whole installer runtime, with the flow VM, the install engine and the pages, needs 111,211 bytes of code. A code segment holds 65,535. Slimming has been tried: a hand-written decoder in place of `serde`'s generated one took about 24 KB out of the first build of 121,725 bytes, and then the Windows 95 work added shortcuts, an uninstaller and a registry entry to the shared install code. Each half still fits on its own, `ENGINE.EXE` at 61,684 bytes of code (94% of the segment) and `UIDEMO.EXE` at 61,186, while the joined program doesn't.

The way out is a packer that splits code across several segments. Quill's copy of the packer already does it for a test program: a call that crosses segments goes through a small veneer in the caller's segment, which keeps a shadow return stack and makes the far jump.

Its three-segment test, with nine cross calls, 60 levels of nesting and function pointers called from each segment, printed `RESULT: PASS` on Windows for Workgroups 3.11. The same work is in progress in the public template, and the installer will take it from there and relink the whole `SETUP.EXE`. Until that happens, the joined installer hasn't run on Windows 3.1, and I won't claim it will.

## Icons show what 256 colours meant in 1993

Some of the Windows 3.1 work is gentler. Quill's icon tests show how Windows 3.11 treats colour: a 16-colour icon uses colours that every display has, so it came out exact on every display tried. A 256-colour icon looks no better on a 256-colour display, because Windows 3.11 draws icons with its 20 fixed system colours there.

![Program Manager on Windows for Workgroups 3.11 at 256 colours, with Quill's icon in a window and minimised on the desktop, drawn in flat patches of the 20 system colours](/blog/rust-on-windows-3-1/quill-icon-256-on-256.png)
*Quill's 256-colour icon on a 256-colour display in DOSBox-X: the gradients become flat patches.*

![The same Quill icon on an 800 by 600 high-colour Windows for Workgroups 3.11 desktop, with smooth gradients](/blog/rust-on-windows-3-1/quill-icon-256-high-colour.png)
*The same icon with a 64K-colour S3 driver. Only a high-colour display shows the gradients, so the 16-colour icon stays the default.*

## What hasn't been run

The gaps matter as much as the passes:

- No real hardware. Everything ran in DOSBox-X, VirtualBox or Wine.
- No Standard mode and no 286. Windows for Workgroups 3.11 refuses Standard mode, and I haven't installed a retail Windows 3.1 to try it.
- The installer runtime hasn't run on Windows Me yet. The earlier spike did.
- No Program Manager group. A Windows 3.1 installer is expected to make one through a DDE conversation with Program Manager, and the seam for it exists without the conversation behind it.
- The joined `SETUP.EXE`, as above, waits for multi-segment code.

![A DOS prompt in DOSBox-X: Windows for Workgroups 3.11 does not run in real or standard modes](/blog/rust-on-windows-3-1/wfw311-standard-mode.png)
*What `WIN /S` gets you on Windows for Workgroups 3.11. A Standard-mode test needs a retail Windows 3.1.*

## Try it

The toolchain is now a public template, [liminal-hq-labs/rust-win16](https://github.com/liminal-hq-labs/rust-win16): the code16 target spec, the NE packer and a separate NE reader that checks it, the import table and stub generator, and three examples (`msgbox`, `hello` and a small `setup`). Its README lists the register and loader pitfalls above. It has been tried on Windows for Workgroups 3.11, Windows Me and Wine, and not on real hardware.

The installer's runtime lives in `retro/win16/` of [liminal-hq-labs/liminal-installer](https://github.com/liminal-hq-labs/liminal-installer), on the `feat/win16-runtime` branch at the time of writing, with the full ESP investigation in `docs/retro-win16.md`. You need `rustup` with `rust-src` and Python 3, and Wine is the quickest way to run the results.

## Credits

**Wine** supplied every ordinal in the import table and the fast half of the test loop. **Open Watcom** was the reference I measured against, header by header, and remains the fallback. **DOSBox-X** ran Windows for Workgroups 3.11 well enough to catch every bug in this post, and possibly to cause one of them, which is still to be found out.

## Next

The bet from the start of this post is still open. Rust on Windows 3.1 installs files and shows real dialogs. Before the installer can rely on it, it needs a packer that splits code across segments, and an answer about ESP.

[Part 3](/blog/rust-on-windows-9x) goes back up to 32 bits for Windows 95, 98 and Me, where Rust's own Windows target is close enough to bend, and a Windows Me virtual machine had a crash of its own to contribute.
