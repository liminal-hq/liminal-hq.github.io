---
title: "Cross-compiling to the past, part 1: Rust on DOS"
date: "2026-11-24"
slug: "rust-on-dos"
excerpt: "Could a Rust game made for the web fit on a 1.44 MB floppy and start when you type FIZZ.EXE? The answer ran through a Windows-flavoured target, an x87 precision fix, keyboard and timer interrupts, and finally a DOS runtime written entirely in Rust."
tags:
  - "Cross-compilation"
  - "Rust"
  - "DOS"
  - "Desk"
  - "Liminal Installer"
draft: true
---

> **In this series: Cross-compiling to the past.** One portable Rust core, built on a modern Linux PC, carried to three old platforms. Quill, a small word processor built the same way, turns up along the way.
>
> 1. **Rust on DOS** (this post): a floppy-disk question, a 32-bit protected-mode runtime, and a Rust pipeline from Linux to DOS.
> 2. [Rust on Windows 3.1](/blog/rust-on-windows-3-1): 16-bit code, a hand-built NE executable, and a crash that arrives with the timer.
> 3. [Rust on Windows 95, 98 and Me](/blog/rust-on-windows-9x): why "any Win32 program" doesn't include Rust's, and what it takes to change that.

Rust has never heard of DOS. Ask `rustc` for its list of built-in targets and you get a few hundred, none of them MS-DOS.

One night I was playing with an idea for Lieutenant Fizz, a retro platformer I'd already built for the web. Episode 1 had sprites, a pogo stick, a Fizz stunner and a Rust simulation running in the browser through WebAssembly. I wondered whether the whole thing could fit on a 1.44 MB floppy disk. Could someone type `FIZZ.EXE` at a DOS prompt and play a level with the same keys I remembered using in Commander Keen?

Before there were graphics or sound, the first thing that got me excited was three lines of plain text:

```text
start
Hello from Rust in DOSBox
rust_hello returned 3.250000
```

Two languages are speaking in that tiny transcript. A C program printed the first line and called a Rust function. Rust asked the C library to print the greeting, calculated `2.0 * 1.5 + 0.25`, and returned the result, which C printed. In three lines I had proof that DOS had loaded the executable, control had crossed into Rust, and a floating-point value had made it back across the boundary.

That was enough to try the game. It also started the work that eventually replaced the C layer with a DOS runtime written in Rust and shared by three projects.

## Why a DOS game started with a "Windows" target

The browser version of Episode 1 already had a clean division of labour. Rust decided where Ben was, whether a tile stopped him, and what happened when a stunner shot hit an enemy. The browser handled input and drew the screen. To reach DOS, I needed an x86 build of that Rust core and a new front end that spoke to PC hardware.

Here are four fields from the custom target specification behind that first greeting. The first line looks like a mistake:

```json
{
  "llvm-target": "i486-pc-windows-gnu",
  "cpu": "i486",
  "binary-format": "coff",
  "target-pointer-width": 32
}
```

Why does a DOS build mention Windows? At that stage I wanted LLVM, Rust's code generator, to emit 486 machine code packaged as COFF object files. An object file is a piece of a program whose final addresses haven't been filled in yet, and COFF is one of the formats for writing such pieces. Choosing an object format and choosing the operating system that loads the finished program are separate decisions, and there are no Windows calls anywhere in the greeting.

The Rust code used `#![no_std]`, and Cargo's `build-std` setting rebuilt `core`, `alloc` and the compiler's support routines from source for this target. A small Python script, `coff2go32.py`, then fixed a difference in how LLVM and DJGPP (the GNU C toolchain for DOS) record relative addresses in COFF. DJGPP linked the Rust archive with a C `main` into the first test program. In the playable game, a small C layer built with DJGPP sets the video mode, hooks the keyboard and timer interrupts and drives the sound chips, and Rust's allocator hands its work to DJGPP's `malloc`.

When you type `FIZZ.EXE`, DOS reads the **MZ** header at the front of the file (every DOS executable starts with the letters `MZ`) and runs the small real-mode loader behind it. That loader starts a **DPMI host**, which the section on Desk explains, and copies the 32-bit game into memory. The floppy carries native x86 machine code. WebAssembly was only how the browser ran its own build of the same rules.

## Could I play the same level before I could see it?

Before drawing a single pixel, I wanted proof that the DOS build played the same game as the browser build. A replay harness fed a fixed stream of key presses into the simulation for 16 levels of 3,000 ticks each, and hashed 26 state values every 60 ticks: 800 fingerprints to compare against the web build's WebAssembly.

The first check didn't even need DOS. A build of the simulation for the x87 unit, run natively on 32-bit Linux, disagreed at tick 120 of the first level, and 466 of the 800 fingerprints differed.

The culprit was floating-point precision. WebAssembly rounds every 64-bit float to a 53-bit significand after every operation. A 486 does floating point in its x87 unit, whose registers hold 80-bit values with a 64-bit significand, so a calculation kept in a register can carry digits the web build had already rounded away.

The fix was to set the x87's precision control to 53 bits before the first tick, and to route maths functions such as `sin` and `atan2` through the pure-Rust `libm` crate on DOS. With that in place, the DOS build in headless DOSBox printed `PASS: 800 checkpoints identical to the web build's wasm`. Ben was moving through the same world on DOS before the DOS port knew how to draw him.

> **The precision fix, in one instruction.** The control word is `0x027F`: all exceptions masked, 53-bit precision, round to nearest, loaded with `fldcw` before any floating-point work that matters. Precision control shortens only the significand and keeps the x87's wider exponent range, so values near the extremes of the range could still differ in principle. A platformer's coordinates stay well inside it.

## Where a hardware interrupt meets a browser event

Making the same core feel alive on two machines decades apart is where modular design stopped being abstract for me.

In the browser, a key press arrives as a DOM event. On a DOS PC, the keyboard raises hardware interrupt request 1 (IRQ 1). The handler reads a scan code that identifies the physical key, updates a table of held keys, and latches each fresh press until the next 60 Hz simulation tick reads it, so a tap shorter than a tick isn't lost. From the player's side, they pressed a key and Ben jumped either way.

Pictures go the other way. The DOS front end draws the frame into a 320 by 200 buffer and copies it into video memory in VGA mode 13h, the 256-colour mode most DOS games of the period used.

![Ben jumping in Crater Fields, with a snack above the gap and an enemy on the far side](/blog/rust-on-dos/fizz1-crater-fields.png)
*Crater Fields in the DOS port of Episode 1. [Screenshot from the game repository](https://github.com/ScottMorris/lieutenant-fizz-dos/blob/d7a5e4e702bef6eb277b41d03b03f4a01bff4b7b/site/img/level0.png).*

Sound is the example I keep coming back to. In the browser, the game hands a cue to a JavaScript audio library. On DOS, the sound driver reprograms the PC's timer to interrupt 560 times a second, the clock the music data is written for, and each tick writes the next register values to the AdLib card's OPL2 synthesizer chip.

If no AdLib card is found, the sound effects move to the PC speaker. The Rust core still only knows that Ben fired his stunner.

By the end of that first night, as I remember it, I could play a level with the keys and sprites I knew from the web, bounce on the pogo stick for a snack, and hear AdLib music come out of DOSBox. Today each release of the DOS port includes a 1.44 MB floppy image.

## How DOS lends Rust a flat 32-bit world

Getting Episode 1 onto a floppy raised a deeper question. How much of that C layer did the PC actually need, and how much was there only because DJGPP had been a convenient doorway? How much of the path could I write myself in Rust?

That question became **Desk**, a calm graphical shell for 486-class machines that also explores a native Rust kernel next to its DOS-hosted build. The test for the DOS side was whether a Linux PC with no C compiler installed could build a complete DOS executable from Rust alone.

A plain DOS program runs in **real mode**, the 8086-compatible mode every PC starts in: at most 640 KiB of conventional memory, reached through 16-bit segments. Rust expects a flat 32-bit address space, a heap, and pointers that behave like plain numbers.

DOS bridges that gap through a **DPMI host** (DOS Protected Mode Interface), usually Charles Sandmann's CWSDPMI. It switches the CPU into 32-bit protected mode, hands out extended memory, and passes requests such as `INT 21h` (DOS) and `INT 10h` (video BIOS) back to real mode.

A DPMI host works a bit like an embassy. Your program lives under protected-mode law, and when it needs a service from DOS or the BIOS, the embassy carries the request across the border. The analogy breaks at the paperwork: CWSDPMI forwards a request with the registers untouched and doesn't translate protected-mode pointers into real-mode addresses, and that gap caused the first real bug in the runtime.

## Describing a 486 to Rust and packing ELF into go32

Desk's custom target, `dos/dos-elf.json`, strips away everything a 486 running DOS can't supply (trimmed; the real file also spells out the data layout):

```json
{
  "llvm-target": "i486-unknown-none-elf",
  "arch": "x86",
  "os": "none",
  "cpu": "i486",
  "features": "-mmx,-sse,-sse2,-sse3,-ssse3,-sse4.1,-sse4.2,-avx",
  "panic-strategy": "abort",
  "relocation-model": "static",
  "linker": "rust-lld",
  "linker-flavor": "ld.lld",
  "executables": true
}
```

A 486 has none of the later instructions that work on several numbers at once (MMX, SSE, AVX), so they're switched off. DOS has no stack unwinder, so panics abort, and nothing on DOS patches addresses at load time, so relocation is static. With the pinned Rust 1.98.0 and `RUSTC_BOOTSTRAP=1`, `.cargo/config.toml` rebuilds the standard pieces from source, with `compiler-builtins-mem` supplying `memcpy` and `memset` in place of a C library:

```toml
[unstable]
build-std = ["core", "alloc", "compiler_builtins"]
build-std-features = ["compiler-builtins-mem"]
json-target-spec = true

[build]
target = "dos-elf.json"
```

`rust-lld`, the linker that ships with Rust, starts the program at `0x1000` so a null pointer lands in 4 KiB of nothing, and aligns sections to 512-byte disk sectors. The result is a standard static **ELF** executable, the program format Linux uses, which no DOS machine can run.

That's why both COFF and ELF come up when people talk about Rust on DOS. In Episode 1, COFF object files went into DJGPP's linker. In Desk, a finished ELF executable comes out of Rust's own linker, and a 139-line Python script with no dependencies, `dos/tools/elf2go32.py`, rearranges its sections behind the MZ stub into DJGPP's "go32" layout.

![How the stub loads the program: on disk, the stub, a 168-byte header, then code and data; in memory, conventional memory below 1 MiB, CWSDPMI, and a block holding the program's code, data, stack and heap](/blog/rust-on-dos/loader-memory.svg)
*How the stub loads a go32 program, drawn from an earlier 160,768-byte build of the installer's `SETUP.EXE`. The block's base address is wherever CWSDPMI put it.*

The stub is the one borrowed binary left. Desk uses DJGPP's 2 KiB `STUB.EXE` with `CWSDPMI.EXE` beside each program, while the installer uses `CWSDSTUB.EXE`, a 22,528-byte stub with the DPMI host built in, so its `SETUP.EXE` runs as a single file.

> **The 168-byte go32 header.** To learn what the stub expects, I disassembled it (DJGPP's `stubify -g` writes it out) and tested each guess by running the result. Right after the MZ stub sits a 168-byte header made of three stacked Unix formats: a 20-byte COFF file header, a 28-byte a.out header, and three 40-byte section headers for `.text`, `.data` and `.bss`. The stub believes nearly all of it and checks only the first two bytes, the magic number `0x014C`. From that earlier build:
>
> ```text
> 00005800: 4c01 0300 0000 0000 0000 0000 0000 0000  L...............
> 00005810: 1c00 0701 0b01 0000 0018 0200 0002 0000  ................
> 00005820: 0002 0400 0010 0000 0010 0000 0028 0200  .............(..
> ```
>
> `4c01` is the magic, `0300` is three sections, `1c00` is the 28-byte a.out header, and `0010 0000` is the entry point, `0x1000`. Because `rust-lld` has already resolved every address, no symbols or relocations are needed.

## What the runtime supplies when std is gone

A `#![no_std]` binary has no allocator, no file access and nothing to call `main`. Desk's `rt` crate supplies that runtime in about 2,300 lines of heavily commented Rust and a small assembly entry point.

At launch, `_start` inherits a tiny stub stack and the stub's own data in the `FS` segment register. It copies that data out, switches to a 256 KiB stack, resets the x87 unit and calls Rust. The instruction after the call is `ud2`, which exists to crash, so an accidental return traps at once instead of running into garbage.

The first Rust routine, `dpmi::init`, uses the DJGPP **near-pointer trick**. It stretches the data segment's limit to 4 GiB so that any address in the machine, including conventional memory, the BIOS data area and VGA memory, is reachable with an ordinary pointer.

Then came the bug the embassy analogy promised. The first `hello` printed 460 NUL bytes. Forwarding `INT 21h` directly handed DOS a protected-mode pointer that meant nothing in real mode, so DOS printed whatever sat at that address in real-mode memory. The fix mirrors DJGPP's C library: a 32 KiB transfer buffer below 1 MiB, bytes copied in and out, and every pointer-taking DOS call made through DPMI's "simulate real-mode interrupt" service.

> **Proof that the buffer is needed.** Desk's 71,168-byte `HELLO.EXE` test program tries a direct `INT 21h` write next to the transfer-buffer path. The `false` is deliberate:
>
> ```text
> dpmi: direct INT 21h AH=40h with a pointer: DOS reports 4 bytes, file holds the buffer: false
> file: wrote 300000 bytes, length 300000
> file: one read call: 300000 bytes, match true
> file: 4 KiB reads: 300000 bytes, match true
> ```

The rest is compact: a first-fit heap behind `#[global_allocator]` so `Vec`, `String` and `format!` work, arguments from the Program Segment Prefix (the block DOS puts in front of every program), x87 `sqrt` and `atan2`, and a panic handler that unhooks interrupts before it prints. A DOS program that leaves the timer interrupt pointing into freed memory takes the next program down with it.

## CMPXCHG and a 255-line batch ladder caught us out

The first CPU exception was on `CMPXCHG`, the instruction Rust emits for an atomic compare-and-swap. A real 486 has it from the B stepping on, yet DOSBox with `cputype = 486` faults on it and runs it fine as a Pentium. Nobody involved knows why DOSBox's 486 model leaves it out.

The runtime is single-threaded, so plain loads and stores replaced it, and the tests stay at the strict 486 setting so a stray atomic shows up at once. That leaves the tested floor at a 486, and a 386 only on paper, since a target that names the i486 may still use other 486-only instructions such as `BSWAP`.

Exit codes were the other trap. Every program runs headless from Linux through `dosrun.sh`, under DOSBox Staging with SDL's dummy video and audio drivers.

DOS has no way to hand an exit status to its host, and DOSBox Staging doesn't expand `%ERRORLEVEL%`, so the script writes a ladder of 255 lines, `if errorlevel 1 set RC=1` up to `255`. `IF ERRORLEVEL n` matches any code greater than or equal to `n`, so the last match wins. It's the least elegant code in the repository, and it lets DOS programs sit in an ordinary test suite with byte-exact transcript checks.

## Three projects, one shape

Once that DOS runtime existed, three Liminal HQ projects settled into the same architecture: a portable core that knows nothing about DOS, a narrow seam of traits, and a thin platform layer underneath.

![Three projects, one shape: portable no_std cores at the top, a trait seam in the middle, DOS and other platforms at the bottom](/blog/rust-on-dos/core-and-platform.svg)
*The pattern all three projects settled on. When something breaks on DOS, the search is through a few thousand lines of platform code instead of the whole program.*

Desk keeps its window manager, drawing and font crates free of DOS calls behind a hardware abstraction layer, so the same shell targets DOS and a native kernel, and its DOS test programs also run unchanged in a browser through js-dos. A small DPMI layer remains on the hosted path, which is a much smaller thing to account for than a hardware layer in C.

Lieutenant Fizz 2, the start of Episode 2, was designed around the split from day one. Its fixed 60 Hz core produces a state hash that native, WebAssembly and DOS builds must agree on after the same scripted replay: `PARITY ok ec9195c222b626f2`. Episode 1 asked whether I could take an existing game back with me. Fizz 2 let me design a game this way from the beginning.

![Lieutenant Fizz 2 running a scripted replay in DOSBox, with Ben on a wooden walkway beside brick towers](/blog/rust-on-dos/fizz2-dos-replay.png)
*`FIZZ2.EXE /REPLAY` in DOSBox Staging. The DOS renderer draws the scene while the simulation produces a state the other builds can check.*

The third is the Liminal Installer. Its flow engine and install logic live in a portable core behind a `Platform` trait, and on DOS, 553 lines of platform code write characters straight into text-mode video memory and read keys from the BIOS. Its 80 by 25 text screens are flattened when the installer is built and checked character for character against the host's under headless DOSBox, an approach Quill pushes to 674 screens across 12 editor scenarios.

## And the floppy has room to spare

The original question was whether a game could fit on a floppy. The installer that will carry it does, comfortably: a `SETUP.EXE` of 136,704 bytes with the DPMI host built in, a 3,494-byte pack holding the example project's files, and a README, leaving 1,316,864 bytes free on a 1.44 MB disk. That size is from the current build of the DOS runtime, which includes a slimming change that hasn't been merged yet; the merged build is 153,088 bytes.

![The installer's welcome screen in DOS text mode: a cyan title bar, a soda-can icon in block art, and a dialog welcoming the user to the Lieutenant Fizz setup](/blog/rust-on-dos/setup-welcome.png)
*`SETUP.EXE` from the Liminal Installer under DOSBox Staging.*

How that pack is laid out, and why it's cut into 32 KiB pieces that a 16-bit program can read, deserves a post of its own.

## Limits and what hasn't been tested

- Everything here has run under DOSBox Staging (and js-dos for Desk's test programs). Nothing has run on a real 386 or 486, under EMM386 or QEMM, or in a Windows 9x DOS box.
- The installer needs DOS 5 or later and about 2 MB of extended memory, for its 256 KiB stack, the compiled project, one 32 KiB chunk and small buffers.
- The DOS installer installs and uninstalls through a receipt file. Spanning several disks, scripts and "Launch after setup" aren't built on DOS yet.
- The CPU floor is a 486 by test and a 386 only on paper, as above.

## Try it

All of these live in public repositories:

- [ScottMorris/lieutenant-fizz-dos](https://github.com/ScottMorris/lieutenant-fizz-dos): Episode 1's floppy-disk port, the precision fix, and the VGA and AdLib drivers.
- [liminal-hq/desk](https://github.com/liminal-hq/desk): the Rust `dos/` target, the `rt` runtime, the `elf2go32.py` packer and the `dosrun.sh` harness.
- [ScottMorris/lieutenant-fizz-2](https://github.com/ScottMorris/lieutenant-fizz-2): Episode 2's deterministic core across DOS, WebAssembly and native builds.
- [liminal-hq-labs/liminal-installer](https://github.com/liminal-hq-labs/liminal-installer): `make dos` fetches the tools, builds `SETUP.EXE` and runs a headless install.

For the Rust-only builds you need `rustup` with `rust-src`, Python 3, and `curl`, `tar` and `xz` for the fetch scripts. No C compiler is required. Episode 1's port also needs DJGPP for its C layer, which its setup script downloads.

## Credits

This rests on decades of other people's work. **DJGPP**, by DJ Delorie and its contributors, defined the go32 layout and wrote the stub. **CWSDPMI**, by Charles W. Sandmann, is the DPMI host inside `SETUP.EXE`.

**DOSBox Staging** made headless, scriptable testing possible, and **js-dos** brought the same DOS programs to the browser.

## Next

Rust never learned DOS. It was told about a 486 and given a few thousand lines of runtime, and that was enough for a game and a text-mode installer. The next question was wilder: could the same Rust core drive a 16-bit Windows 3.1 wizard with real native buttons?

In [Part 2](/blog/rust-on-windows-3-1), the series drops to 16 bits, where there is no flat address space to hide in and Windows quietly changes a CPU register about twenty times a second.
