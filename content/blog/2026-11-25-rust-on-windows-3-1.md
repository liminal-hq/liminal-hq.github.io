---
title: "Cross-compiling to the past, part 2: Rust on Windows 3.1"
date: "2026-11-25"
slug: "rust-on-windows-3-1"
excerpt: "Rust can build real 16-bit Windows programs with LLVM's code16 mode, rust-lld and a home-made NE packer. On Windows for Workgroups 3.11 the installer engine faulted in four runs out of ten, and the trail led to a register the CPU only half restores."
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
> 1. [Rust on DOS](/blog/rust-on-dos): a 32-bit protected-mode runtime, a packer, and a DOS installer.
> 2. **Rust on Windows 3.1** (this post): 16-bit code, a hand-built NE executable, and a crash that arrives with the timer.
> 3. [Rust on Windows 95, 98 and Me](/blog/rust-on-windows-9x): why "any Win32 program" doesn't include Rust's, and what it takes to change that.

Four of the last ten runs died. The program was `ENGINE.EXE`, the install engine of the [Liminal Installer](https://github.com/liminal-hq-labs/liminal-installer) built as a 16-bit Windows program in Rust, and on Windows for Workgroups 3.11 it installed and uninstalled Lieutenant Fizz byte for byte when it ran to the end. The other times it stopped with a General Protection Fault, Windows 3.x's message for a program that touched memory it doesn't own, or with a "Rust panic" box, each time somewhere new.

![A Windows 3.11 dialog titled Software License Agreement, with a scrolling licence, accept and decline buttons, and Back, Next and Cancel](/blog/rust-on-windows-3-1/uidemo-licence.png)
*The installer's licence page on Windows for Workgroups 3.11 in DOSBox-X: real Windows controls, laid out from the same compiled project the DOS installer reads.*

A crash that moves around is the worst kind to chase, and this one took a series of probe programs to pin down. The trail runs through how a 2026 Rust compiler produces a Windows 3.1 program at all, because the crash lives in exactly that trick. The next four sections are that background; the investigation picks up again at "Windows changes registers it promised nothing about".

## Why the installer's Windows 3.1 runtime is Rust at all

[Part 1](/blog/rust-on-dos) got Rust onto DOS in 32-bit protected mode, where memory is flat and a pointer is a number. The installer's DOS runtime runs a portable core called `li-retro`, and I wanted Windows 3.1 to run that same core. A second installer in another language would mean every fix made twice.

There were two other routes. Win32s, Microsoft's add-on that let some 32-bit programs run on Windows 3.1, would need installing before our installer could run, which defeats the point. Open Watcom C builds real 16-bit Windows programs today, but it shares no code with the Rust core. So the installer's decision log (D46) chose Rust and kept Open Watcom as the fallback, and this post is partly about whether that bet holds.

## A Windows 3.1 program lives in 64 KiB rooms that the loader furnishes

A Windows 3.x executable is an **NE** file, for New Executable. Its code and data live in **segments** of at most 64 KiB each, and a program reaches a segment through a selector, a handle that Windows assigns when it loads the file. A program doesn't know its own selectors when it's linked, and it certainly doesn't know where `USER.EXE` will put `MessageBox`.

So every call into Windows is a **far call**, one that names a segment as well as an offset, and the loader writes the target into the code at load time. NE calls these patches **fixups**. Windows functions also use the **Pascal** calling convention: arguments go on the stack left to right as 16-bit words, and the function being called cleans them up. Functions are imported by number, so `MessageBox` is `USER.1`, and the first call every Windows program makes, `INITTASK`, is `KERNEL.91`.

Think of a segment as a furnished room. The analogy holds for the size limit and for the loader moving furniture in, and it breaks at the walls: on a 386 the walls are enforced by hardware, and a read one byte past them stops the program. Hold on to that, because it's how the crash works.

## LLVM writes 16-bit code by mostly writing 32-bit code

LLVM has a mode for one niche, x86 boot code. The target `i386-unknown-none-code16` emits code for a 16-bit segment, and most of its instructions are still 32-bit ones. Each carries a one-byte prefix (`66h` for operand size, `67h` for address size), a note to the CPU that says "read this one as 32-bit", which a 386 honours in a 16-bit segment.

Here's a slice of the smallest program, disassembled as 16-bit code:

```text
  ab:   66 6a 00              pushd  0x0
  bd:   66 e8 91 ff ff ff     calld  54 <MessageBox>
  c3:   66 83 c4 10           add    esp,0x10
  d2:   67 66 8b 74 24 14     mov    esi,DWORD PTR [esp+0x14]
```

Every call between Rust functions is a 32-bit near call, which stays inside one segment, and every stack access goes through ESP, the 32-bit stack pointer, all 32 bits of it. Both facts come back later: the first limits how big a program can be, and the second is the crash.

The prefixes also set the hardware floor. A 286 has no 32-bit registers, so this code can't run on one, and Windows 3.1's Standard mode on a 286 is out. Standard mode on a 386 would execute the prefixes, but I haven't tested it, so the floor I can state is a 386 in Enhanced mode.

## The packer writes down every gap for the loader to fill

The linker turned out to be the awkward part. In an NE file the code and data segments each start at offset 0, so `.text` and `.data` must both be linked at address 0, and `rust-lld` refuses: `virtual address range overlaps`. The way around it is an `OVERLAY` in the linker script, a feature from the days when programs swapped parts of themselves through the same memory.

Calls into Windows go through generated stubs. `tools/imports.tbl` has a row per function with its ordinal and a tiny signature, and the ordinals and argument counts come from Wine's `.spec` files for the 16-bit system libraries:

```text
KERNEL 15 GlobalAlloc wl w
USER 1 MessageBox wppw w
USER 87 DialogBox wlwf w
```

Each letter is one argument: `w` a word, `l` a long, `p` a data pointer, `f` a code pointer. From each row the generator writes a stub that converts Rust's 32-bit arguments into Pascal words and far pointers, makes the far call, and repairs the CPU's state afterwards. That repair work is where this story ends up.

The packer, `ne_pack.py`, then turns the linked ELF file into an NE executable. Part 1's DOS packer had nothing to resolve, because `rust-lld` had fixed every address. On Windows nothing is fixed until load time, so this packer describes every gap: one fixup per import, entry records for window procedures, name tables and resources such as dialogs.

![Byte layout of MSGBOX.EXE: a DOS stub, the NE header and tables, a 261-byte code segment with four far-call sites, four relocation records pointing back at them, and a 44-byte data segment](/blog/rust-on-windows-3-1/msgbox-ne-layout.svg)
*The whole of `MSGBOX.EXE` as the spike built it, 620 bytes. The four orange bands are the far calls the loader patches.*

The program behind that layout is all of this:

```rust
#[unsafe(no_mangle)]
pub extern "C" fn w16_main(_hinst: u32, _hprev: u32, _show: u32) -> u32 {
	unsafe { MessageBox(0, cs!("Hello from Rust"), cs!("Win16"), MB_OK) };
	0
}
```

That single call is the whole program; the start-up work lives in the runtime's `_start`. The same message box in C, built with Open Watcom, is 1,478 bytes by default and 1,250 built for size. That's a fun comparison and an unfair one, since Open Watcom's code runs on a 286 and ours doesn't.

![Program Manager on Windows for Workgroups 3.11 with a message box reading "Hello from Rust, in 16-bit Windows"](/blog/rust-on-windows-3-1/wfw311-hello.png)
*`HELLO.EXE` on Windows for Workgroups 3.11. After this box it opens a window, paints it with `TextOut` and runs a three-page wizard from its resources.*

## Six bugs looked right until Windows 3.11 ran them

I tested on Wine 11.21, which still runs 16-bit programs, and on Windows for Workgroups 3.11 in DOSBox-X. Wine was the fast loop. The spike's report says Wine tolerated two of the six mistakes below that real Windows did not, and the other four only looked right on paper; it doesn't record which two.

1. "Insufficient memory to run this application." The loader follows a chain of fixups through the bytes it's about to patch, and `0xFFFF` ends the chain. The linker had left zeros there, so the chain led to offset 0. The packer now writes `0xFFFF` into every call site.
2. A message box reading "Hello P omÅ". Windows keeps its own bookkeeping in the first 16 bytes of the data segment, and the program's first string sat right there. The linker script now reserves them.
3. The task died inside `INITTASK`, because one instruction ran before it that changed a register `INITTASK` reads.
4. A dialog that never opened, because NE resource lengths count alignment units, and the last resource was a few bytes short.
5. A General Protection Fault in `rep movsb`. Windows doesn't preserve the ES register, and Rust's block copies use it, so the stubs reload it after every call.
6. `_lcreat` failing after a `mkdir`, because the DOS call that made the directory clobbered registers the compiler thought were safe.

Each was found the slow way: build, copy, boot Windows, look, think. With those fixed, the spike's 14,944-byte installer proof ran on Windows 3.11, on Wine, and on Windows Me (which reports itself to a 16-bit program as Windows 3.95), and installed its file correctly.

## Windows changes registers it promised nothing about

A **register** is one of the CPU's few named scratch slots. On a 386 they're 32 bits wide, and the low 16 bits of each, such as `SP` inside `ESP`, are the only part 16-bit Windows was written to know about. A 16-bit Windows function owes its caller only SI, DI, BP and DS, and Rust keeps live values in the full EBX, ESI and EDI across calls.

Bug 5 raised a wider question about what else Windows changes. Quill ran the careful version of that experiment. Its probe fills the registers with patterns, makes raw API calls with no protective stub, and logs what comes back, while a second copy of the program runs alongside. The log from Windows 3.11:

```text
GetVersion=05000A03 GetWinFlags=00000C29 386 Enhanced mode
probe PeekMessage: EBX=55550000 ESI=6666BE02 EDI=7777BE03 EBP=8888BE04 ESP=800144AA ... CLOBBERED
probe Yield via stub: EBX=1111BE01 ESI=2222BE02 EDI=3333BE03 EBP=4444BE04 ESP=000044D2 ... PRESERVED
```

The task loaded `2222BE02` into ESI and got `6666BE02` back. The low half was restored, but the high half belonged to the other task, which had run in the meantime. Across 326,235 rounds, raw calls changed the second task's registers 150,316 times, and calls through the stubs changed them zero times. Wine keeps the high halves intact, which is why it could never have found this.

So every stub now saves EBX, ESI, EDI and EBP at full width, and so does the wrapper for window procedures that Windows calls. Note the other detail in the first probe line: ESP came back with `8001` in its high half. Quill's notes read that as harmless, since the stubs clear it with `movzx esp, sp`. That reading was right for Quill's probe and wrong for the installer.

## The faults came back when the program grew

The installer's whole Windows 3.1 runtime didn't fit in one code segment (more on that below), so it was built as two halves that did: `ENGINE.EXE`, which installs and uninstalls from the pack, and `UIDEMO.EXE`, which shows the pages. Both ran. Both also died now and then, in different places.

One early suspect was memory. Windows 3.11 doesn't zero the part of a segment past its length in the file, or the unused stack, so the program's entry code now clears both. The project's notes record the failure rate falling from "about 2 in 5" to "about 1 in 6", without the run counts behind them. Then the build grew, and the last 10 runs of `ENGINE.EXE` (5 installs, 5 uninstalls) faulted 4 times, back where it started.

Another suspect was jump tables. In Quill's probe, a four-way `match` compiled to `jmp [ebx*4+0x10]`, and the jump landed at `0001:11D0`, in the middle of a `call` instruction. Jump tables were switched off in both projects, and the faults carried on.

Only later did anyone notice that `11D0` is also Program Manager's window handle, printed a few lines earlier in the same log. The table hadn't been built wrong. Something had written over it.

## The clue was ESP going bad about 20 times a second

The faults had one thing in common. The General Protection Faults hit a `rep movs` copying a value whose address came from `lea esi, [esp+x]`, an address built from the stack pointer.

So I wrote a probe that does nothing but loop in assembly, touching no stack memory, and checks the high half of ESP on every pass. In 6.3 seconds it found ESP above `0xFFFF` 130 times, always `8001xxxx`, cleaning it each time. That's 20.6 a second. The standard PC timer ticks 18.2 times a second, and I don't know whether the gap comes from the probe, from DOSBox-X, or from a timer that Windows reprograms.

![A timeline: a stub clears ESP after a Windows call, Rust reads the stack safely, a timer tick leaves 8001 in the high half of ESP, and the next stack read faults past the end of the segment](/blog/rust-on-windows-3-1/esp-timeline.svg)
*How a tick breaks a stack read. The ESP values follow the probe's pattern.*

code16 addresses the stack through all 32 bits of ESP, so the first stack read after a dirty tick asks for an offset about 2 GiB past the end of a 64 KiB segment. Each Windows call ends in a stub that cleans ESP, which is why short stretches of Rust survived, while a few milliseconds of decoding or inflating with no API call in between was likely to meet a tick. A stray write through a bad stack address also fits the overwritten jump table.

> **What didn't fix it.**
>
> - Hooking the timer interrupts (INT 08h and INT 1Ch) to clean ESP changed nothing: the counts were 129 and 133. The dirt is made after the handlers run.
> - A frame pointer copies the dirt into EBP, and locals addressed through EBP fault the same way.
> - Making the task's whole stack 32-bit (SS made an alias of DS with the "big" bit set through DPMI) took the count to zero and let installs run. Uninstalls then faulted inside Windows' own `KRNL386` in 3 runs out of 3.

## The root cause is how a 386 returns to a 16-bit stack

When an interrupt ends, the CPU returns to whatever stack the program was on. If that stack segment is a 16-bit one, a 386 restores only SP, the low half, and ESP's high half keeps whatever the system code left there. In 386 Enhanced mode, Windows 3.11 leaves `8001` at every timer tick. It's the same CPU behaviour that Linux has had to work around for 16-bit stacks, under the name "espfix".

That also explains the failed experiment. A stack segment marked 32-bit gets all of ESP back, which is why the count dropped to zero. But making the task's own stack 32-bit put Windows' 16-bit KERNEL code on a stack it was never written for, and that's what faulted in `KRNL386`.

## The fix gives Rust a 32-bit stack and leaves Windows on its own

The fix, in a pull request on the public template (PR #3), keeps the two apart:

- At start-up, `_start` asks DPMI for a second selector over the same stack memory, marked 32-bit, and Rust runs on that alias.
- Each import stub switches back to the real 16-bit stack right before its far call into Windows, and to the alias right after, so Windows only ever runs on the stack it gave the task.
- Because Windows can move the data segment when it compacts memory, the runtime moves the alias after each call if the base has changed.

The test program, `BIGSEG.EXE`, has 88 KB of code in five segments and checks every result against a second implementation. It passed 40 runs out of 40 on Windows for Workgroups 3.11 under DOSBox-X, with no wrong results. The same binary with the alias turned off gave wrong results in 3 runs out of 20, about 1 in 7, close to the installer's 1 in 6. So the installer's intermittent fault was the ESP dirt all along, and not the packer or the stubs.

In the template, jump tables are back on, and `BIGSEG.EXE` checks one on Windows 3.11.

## The other wall was 64 KiB of code

The crash wasn't the only problem. LLVM's code16 mode emits only near calls (`66 E8` and a 32-bit offset). It can't emit a far call, so every function had to sit in the same code segment as everything that calls it, and a segment holds 65,536 bytes (offsets 0 to 65,535).

The whole installer runtime, with the flow VM, the install engine and the pages, first came to 121,725 bytes of code. Slimming took it to 97,265, and then the Windows 95 work added shortcuts, an uninstaller and a registry entry to the shared install code, which brought it to 111,211. Each half fit on its own, `ENGINE.EXE` at 61,684 bytes of code (94% of the segment) and `UIDEMO.EXE` at 61,186, while the joined program didn't.

> **One change, three runtimes.** The biggest single cut was decision D72: a hand-written project decoder in place of `serde`'s generated one, a vector in place of a `BTreeMap`, and no sort at run time. The same change shrinks all three of the installer's old-machine runtimes:
>
> | Runtime | Before | After | Measured as |
> |---|---|---|---|
> | Windows 3.1 | 121,725 | 97,265 | bytes of code |
> | DOS `SETUP.EXE` | 153,088 | 136,704 | bytes of file |
> | Windows 95 `SETUP.EXE` | 135,680 | 115,200 | bytes of file |
>
> The "after" builds are on the installer's Windows 3.1 branch, PR #36, not yet merged.

The same pull request removes that wall. The packer now places functions in several NE code segments itself. A call that crosses segments goes through a small veneer in the caller's segment that makes the far jump, and tail calls and calls through function pointers go through a shadow return stack in the data segment. Every function whose address is taken gets a slot at the same offset in every segment, so a function pointer means the same thing wherever it's called.

Segments can also be loaded on first call and thrown away under memory pressure, through a gate that moves to the 16-bit stack while Windows reloads them. In each of the 40 runs, `BIGSEG.EXE` had its third segment discarded and reloaded. The limits are 253 code segments, a 1 MB file, and no function bigger than one segment. Quill built the first version of this idea, and the shared packer took it over so the two projects don't split every fix.

The smallest program paid for the stack code: `MSGBOX.EXE` grew from 620 to 948 bytes.

## Limits and what hasn't been tested

- Only DOSBox-X has shown the fix. Since the root cause is how a 386 returns to a 16-bit stack, I expect a real machine to behave the same, but no real hardware and no other emulator has run it.
- The template's change is still a pull request, and the installer's whole `SETUP.EXE` is being relinked with it. Until that build passes its own runs on Windows 3.11, I won't claim the installer works there.
- No Standard mode and no 286. Windows for Workgroups 3.11 answers `WIN /S` with "does not run in real or standard modes", and I haven't installed a retail Windows 3.1 to try it.
- Windows Me has run the single-segment programs and hasn't run the new stack code yet.
- No Program Manager group. A Windows 3.1 installer is expected to make one through a DDE conversation with Program Manager, and the seam for it exists without the conversation behind it.

## Try it

The toolchain is a public template, [liminal-hq-labs/rust-win16](https://github.com/liminal-hq-labs/rust-win16): the code16 target spec, the NE packer and a separate NE reader that checks it, the import table and stub generator, and the examples (`msgbox`, `hello`, a small `setup`, and `bigseg` in PR #3). Its README lists the register and loader pitfalls above. It has been tried on Windows for Workgroups 3.11, Windows Me and Wine.

The installer's runtime lives in `retro/win16/` of [liminal-hq-labs/liminal-installer](https://github.com/liminal-hq-labs/liminal-installer), in PR #36 at the time of writing, with the ESP investigation in `docs/retro-win16.md`. You need `rustup` with `rust-src` and Python 3, and Wine is the quickest way to run the results.

## Credits

**Wine** supplied every ordinal in the import table and the fast half of the test loop. **Open Watcom** was the reference I measured against, header by header, and remains the fallback. **DOSBox-X** ran Windows for Workgroups 3.11 well enough to catch every bug in this post, including the one that took longest.

## Next

The case, in order: an installer that died in four runs out of ten, each time somewhere new. Memory that Windows didn't clear was a real problem, but fixing it didn't stop the faults, and the jump tables that looked broken had been written over. The clue was a probe that watched ESP's high half turn `8001` about 20 times a second.

The cause is a 386 restoring only SP on its way back to a 16-bit stack, and the fix runs Rust on a 32-bit alias while Windows keeps its own stack, with 40 clean runs out of 40. What's still unproven is everywhere except DOSBox-X: real hardware, other emulators, Windows Me and Standard mode.

The bet D46 made, Rust for Windows 3.1 with Open Watcom in reserve, holds so far. [Part 3](/blog/rust-on-windows-9x) goes back up to 32 bits for Windows 95, 98 and Me, where Rust's own Windows target is close enough to bend, and a Windows Me virtual machine had a crash of its own to contribute.
