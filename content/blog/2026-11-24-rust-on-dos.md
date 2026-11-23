---
title: "Cross-compiling to the past, part 1: Rust on DOS"
date: "2026-11-24"
slug: "rust-on-dos"
excerpt: "Rust has no DOS target, so I described one: a freestanding i486 target, a hand-written DPMI client, a 139-line packer and a headless DOSBox harness. The result now runs a real DOS installer that reads its files from a pack built for floppies."
tags:
  - "Cross-compilation"
  - "Rust"
  - "DOS"
  - "Desk"
  - "Liminal Installer"
draft: true
---

> **In this series: Cross-compiling to the past**
>
> 1. **Rust on DOS** (this post): a 32-bit protected-mode runtime, a packer, and a DOS installer.
> 2. [Rust on Windows 3.1](/blog/rust-on-windows-3-1): 16-bit code, a hand-built NE executable, and a crash that arrives with the timer.
> 3. [Rust on Windows 95, 98 and Me](/blog/rust-on-windows-9x): why "any Win32 program" doesn't include Rust's, and what it takes to change that.

Ask `rustc --print target-list` for DOS and it lists a few hundred targets, none of them DOS. The program below is a DOS program anyway. Its latest build is 136,704 bytes of Rust, made on Linux by a pinned Rust 1.98.0 toolchain with no C compiler installed, and in the screenshot it's about to install a game onto drive C: of an emulated 1994 PC.

![The installer's welcome screen in DOS text mode: a cyan title bar, a blue dotted background, a soda-can block-art icon with Step 1 of 8, and a grey dialog welcoming the user to the Lieutenant Fizz setup](/blog/rust-on-dos/setup-welcome.png)
*`SETUP.EXE` from the [Liminal Installer](https://github.com/liminal-hq-labs/liminal-installer), running under DOSBox Staging.*

I wanted to know whether that was possible because Liminal HQ has several projects that want to run on old PCs, starting with [Desk](https://github.com/liminal-hq/desk), a calm graphical shell for 486-class machines. The rule was strict: pure Rust, no `gcc`, no C library, built with tools we control and tested headless like any other code. This post starts at the screen above and zooms in one layer at a time, then zooms back out to the installer and the pack format it now reads.

## DOS gives a program 640 KiB, unless something lends it more

A plain DOS program runs in **real mode**, the 8086-compatible mode every PC starts in. It gets at most 640 KiB of conventional memory, reached through 16-bit segments. Rust wants a flat 32-bit address space, a heap, and pointers that are plain numbers.

DOS can host that with help from a **DPMI host** (DOS Protected Mode Interface). It's a resident program that switches the CPU into 32-bit protected mode, hands out extended memory, and passes calls such as `INT 21h` (DOS) and `INT 10h` (video BIOS) down to real mode. DJGPP programs have worked this way since the mid-1990s, usually with Charles Sandmann's **CWSDPMI** as the host.

A DPMI host works a bit like an embassy. Your program lives under protected-mode law, and when it needs something from DOS or the BIOS, the embassy carries the request across the border. The analogy breaks at the paperwork: CWSDPMI forwards a request as it stands and doesn't translate the pointers in it, and that gap caused the first real bug in the runtime.

The other piece is the **stub**. A DOS `.EXE` has to start life as a real-mode program, so a DJGPP executable begins with a small loader that finds or starts a DPMI host, switches to protected mode, copies the program into memory and jumps to it. Everything after the stub is a 32-bit image in DJGPP's "go32" COFF format.

So Rust needs two things before it can run here. It needs a compiler that emits 32-bit code for no operating system, in a file the stub will load, and it needs a runtime that stands in for the operating system Rust usually expects.

## Rust will build for a CPU it has never heard of, if you describe it

Rust has no `i486-pc-msdos` target, but it accepts a target described in JSON. Here is Desk's `dos/dos-elf.json`, trimmed (the real file also spells out the data layout):

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

Each line removes something DOS can't provide. A 486 has an x87 maths unit and no SIMD, so every vector extension is off. There's no unwinder, so panics abort, and since nothing on DOS will patch addresses at load time, relocation is static.

Rust ships no precompiled `core` or `alloc` for a target it has never seen, so Cargo builds them from source with `-Zbuild-std`. That flag is unstable, so the build sets `RUSTC_BOOTSTRAP=1` and the pinned stable toolchain accepts it. The relevant part of `.cargo/config.toml`:

```toml
[unstable]
build-std = ["core", "alloc", "compiler_builtins"]
build-std-features = ["compiler-builtins-mem"]
json-target-spec = true

[build]
target = "dos-elf.json"
```

`compiler-builtins-mem` supplies `memcpy` and friends, which normally come from the C library this project doesn't have. The linker is `rust-lld`, which ships with the toolchain. Its script starts the image at `0x1000`, so a null pointer lands in 4 KiB of nothing, and aligns each section to 512 bytes because the stub reads the file in sectors.

`cargo build --release` then produces a static ELF executable. It's perfectly ordinary, and no DOS machine can run it.

## The stub reads 168 bytes of header and checks two of them

DJGPP's own linker writes go32 files directly, but using it would bring back the GNU toolchain I was trying to leave. Desk has `dos/tools/elf2go32.py` instead, a 139-line Python script with no dependencies.

I found what the stub needs by disassembling it (DJGPP's `stubify -g` writes it out) and confirmed each guess by running the result. The list is short.

The 168 bytes after the stub must hold a COFF file header, an a.out header and three section headers named `.text`, `.data` and `.bss`, in that order, and of all those bytes the stub checks only the two-byte magic number `0x014C`. The entry point is a plain offset. Sections are copied in 512-byte reads, `.bss` is zeroed for you, and the memory block is the end of `.bss` rounded up to 64 KiB.

There are no symbols and no relocations to write, because `rust-lld` has already resolved every one. The packer reads the ELF program headers, calls the first loadable segment `.text` and the second `.data` plus `.bss`, writes the headers, pads, and appends.

> **The header, byte by byte.** The first bytes after the stub, from an earlier 160,768-byte build of `SETUP.EXE`:
>
> ```text
> 00005800: 4c01 0300 0000 0000 0000 0000 0000 0000  L...............
> 00005810: 1c00 0701 0b01 0000 0018 0200 0002 0000  ................
> 00005820: 0002 0400 0010 0000 0010 0000 0028 0200  .............(..
> 00005830: 2e74 6578 7400 0000 0010 0000 0010 0000  .text...........
> ```
>
> `4c01` is the magic, `0300` is three sections, `1c00` is the 28-byte a.out header, and `0010 0000` is the entry point, `0x1000`.

![How the stub loads the program: the file holds the stub, a 168-byte COFF header, .text and .data; memory holds conventional memory with the PSP, transfer buffer and VGA, CWSDPMI, and the image block with .text at 0x1000, .data, .bss and the stack, plus heap blocks](/blog/rust-on-dos/loader-memory.svg)
*What the stub does with the file. The offsets are from the same earlier build; the image block's base is wherever CWSDPMI put it.*

The stub itself is the one piece still borrowed. Desk uses DJGPP's 2 KiB `STUB.EXE` and ships `CWSDPMI.EXE` beside each program. The installer uses `CWSDSTUB.EXE` from the CWSDPMI package, a 22,528-byte stub with the DPMI host built in, so `SETUP.EXE` runs as a single file on a machine with no host at all. Without either, the stub prints `Load error: no DPMI - Get csdpmi*b.zip` and exits, which is still good advice.

## The runtime does what `std` would have done

A `no_std` program has no allocator and no way to print, and nothing calls its `main`. Desk's `rt` crate supplies those in about 2,300 lines, a fair share of them comments explaining why.

The entry point, `_start`, is written in assembly. The stub hands over an odd machine: a stack a few hundred bytes deep and the stub's own data in `FS`. So `_start` copies that data out, moves to a 256 KiB stack, resets the x87, and calls Rust. It never returns, and the instruction after the call is `ud2`, an instruction that exists to crash. (A test program that returned anyway jumped into whatever the stub had left on its stack, and DOSBox stopped with a page fault.)

The first Rust code to run is the DPMI client. The stub's data segment covers only the program's own block, but heap memory from DPMI lands elsewhere. So `dpmi::init` stretches the data segment's limit to 4 GiB and reloads it, after which any address in the machine is one pointer away, including the first megabyte with the BIOS data area and video memory. DJGPP programs call this the near-pointer trick.

Then came the bug the embassy analogy promised. The first `hello` printed 460 NUL bytes. A protected-mode pointer means nothing in real mode, and CWSDPMI r7 forwards `INT 21h` with the registers untouched, so DOS read whatever sat at that address in real-mode memory. The fix is what DJGPP's C library does: a 32 KiB transfer buffer below 1 MiB, data copied in and out, and every pointer-taking call made through DPMI's "simulate real-mode interrupt" service.

The rest is smaller: a first-fit heap behind `#[global_allocator]` so `Vec`, `String` and `format!` work, arguments from the PSP (the block DOS puts in front of every program), x87 `sqrt` and `atan2` (which `core` lacks), and a panic path that unhooks interrupts before it prints anything. A DOS program that leaves the timer interrupt pointing into freed memory takes the next program down with it.

![A DOS screen showing the hello program's output: allocation, x87 float results, DPMI version 0.90 and vector round trips, and 300,000-byte file reads and writes](/blog/rust-on-dos/desk-hello-transcript.png)
*Desk's `HELLO.EXE` in DOSBox Staging, rebuilt with CWSDPMI inside it (71,168 bytes). The `false` on the direct `INT 21h` line is deliberate: it's the evidence for the transfer buffer.*

One surprise came from the emulator. The first CPU exception was on `CMPXCHG`, which Rust emits for atomic compare-and-swap, and which DOSBox faults on with `cputype = 486`. The runtime is single-threaded, so it uses plain loads and stores, and the strict CPU setting stayed in every test because it catches anything an old CPU can't run.

## Testing a DOS program from Linux takes a 255-line batch file

Every DOS program here runs headless under DOSBox Staging through `dosrun.sh`. It mounts a folder as `C:`, runs the program from a generated batch file with output redirected to `D:`, starts DOSBox with SDL's dummy video and audio drivers, and returns the output and exit status as if the program were a local command.

The exit status was the awkward part. DOS has no way to hand one to its host, and DOSBox Staging doesn't expand `%ERRORLEVEL%`. So the batch file has a ladder of 255 lines, `if errorlevel 1 set RC=1` up to `if errorlevel 255 set RC=255`, and because `IF ERRORLEVEL n` is true for every `n` up to the status, the last match wins. It's the least elegant code in the project and it has never been wrong.

From the shell, a DOS program then looks like any other:

```bash
$ dos/tools/dosrun.sh desk HELLO.EXE | head -3
D0-HELLO ok
args: 0 []
comspec: true
```

Each example has a recorded transcript, and the check fails on a single changed byte. `HW.EXE` goes further: it hooks the timer, counts 18 to 20 ticks in about a second, then draws in VGA mode 13h and checksums video memory.

## Every project here settled on the same shape

With the runtime working, Desk built its shell. `SHELL.EXE` adds drivers for the keyboard controller, the mouse and VGA and VESA graphics under a small hardware abstraction layer. The rule that keeps it manageable is checked on every run: the shell crates are `no_std`, make no DOS calls, and depend on the hardware layer and nothing else.

Lieutenant Fizz 2, Liminal HQ's Keen-style platformer, took the same shape. Its rules and drawing code step at a fixed 60 Hz and hash the game state every tick. A native build, a WebAssembly build and the DOS build play the same scripted replay and must agree on the hash: `PARITY ok ec9195c222b626f2`.

![Lieutenant Fizz 2 running on DOS: Ben on a wooden walkway at night, red brick towers, a green exit door and a HUD reading Fizz 5, Score 00002, Lives 2](/blog/rust-on-dos/fizz2-dos-replay.png)
*`FIZZ2.EXE /REPLAY` in DOSBox Staging, partway through the scripted run. The floating words are captions for the game's sound effects.*

![Three projects, one shape: portable no_std cores at the top, a trait seam in the middle, DOS and other platforms at the bottom](/blog/rust-on-dos/core-and-platform.svg)
*The pattern all three projects settled on. When something breaks on DOS, the search is through a few hundred lines of platform code.*

The DOS builds have since reached a browser without changing. Desk's spike `s5-jsdos` ran every program the repository builds for DOS, `HELLO.EXE` and `HW.EXE` included, in js-dos 8.5.3, a DOSBox that runs in a web page. Their transcripts matched the native harness byte for byte, and the mode 13h test pattern came out with zero of its 64,000 pixels different. js-dos is GPL-2.0, so Desk fetches a pinned, checksummed copy at build time and doesn't commit it.

## The installer reads a pack built for floppies

The Liminal Installer builds installers for many systems from one project. Its `dos/` folder is a copy of Desk's target, linker script, packer, harness and the parts of `rt` it needs, with every change listed in `dos/PROVENANCE.md`. A project names a DOS target like any other:

```toml
id       = "dos-x86"
renderer = "tui-retro"
theme    = "fizz-dos"
outputs  = ["floppy-1440", "zip"]
```

Inside, the shape from the diagram repeats. `li-retro` is the portable core: the compiled project format, a bytecode VM for conditions, the flow VM that walks the install steps, a text renderer and the install engine, behind a `Platform` trait. On DOS, the 553 lines of `dos/setup` write cells to text memory at `B8000h`, read keys from the BIOS and call `rt` for files.

The first version kept the files in `SETUP.DAT`, a one-off layout. It now reads `SETUP.LPK`, a **Liminal Pack**: one format meant for the DOS, Windows 3.1 and Windows 95 runtimes alike. Building the example project and listing its pack:

```text
$ liminst build -t dos-x86 --version 1.0.0 --dos-runtime dos/dist/SETUP.EXE -o out
files: out/dos (SETUP.EXE, SETUP.LPK and README.TXT; 175 bytes installed from a 3494-byte pack)
$ liminst lpk list out/dos/SETUP.LPK
6 files, 12284 bytes, 1 volume, chunks of 32768 bytes, set e737e0b1
     12109 72299a5e ---- 1980-01-01 00:00 v1 SETUP.PRJ
        34 7b25e07a ---- 1980-01-01 00:00 v1 FIZZ.EXE
        35 223b7573 ---- 1980-01-01 00:00 v1 LEVELS/EP1.LVL
```

The first entry, `SETUP.PRJ`, is the compiled project; the rest are the game's files (stand-ins, so this is a real install of a pretend game). The columns are size, CRC-32, attributes, date and volume.

![The layout of a Liminal Pack across two disks: SETUP.LPK holds a header, the directory, chunks, a next-disk marker and a footer; SETUP.L02 holds a header, chunks and a footer](/blog/rust-on-dos/lpk-layout.svg)
*A Liminal Pack, from `docs/lpk-format.md` in the installer repository.*

Each choice in the format comes from an old machine's limit. Files are cut into chunks of at most 32 KiB, and each chunk is its own raw DEFLATE stream that refers to nothing outside it. A 16-bit Windows program can't allocate a buffer bigger than one 64 KiB segment, and with independent chunks the reader needs only one decoded chunk and a 256-byte read buffer. That costs some compression, 7.3% on text and 2.7% on an executable in the format's own measurements.

Every file has an upper-case 8.3 name that DOS can create, and may carry a long name for systems that have them; the packer gives anything longer a generated short name such as `LONGFI~1.TXT`. Checksums are CRC-32 everywhere, the same as the install receipt and `zip -T`, and the tests flip every bit of a pack to prove each flip is caught. A pack can also span disks as `SETUP.LPK`, `SETUP.L02` and onward, with no chunk ever split between two of them.

> **What the pack did to the size of `SETUP.EXE`.** The DOS runtime used `miniz_oxide` for decompression, which needs `alloc` and a 32 KiB state of its own. The pack's reader is `no_std`, allocates nothing and uses no `unsafe`, and swapping it in took `SETUP.EXE` from 161,280 to 153,088 bytes. A hand-written project decoder in place of `serde`'s derive, on a branch built for the Windows 3.1 work, brings it to the 136,704 bytes at the top of this post. The pack's header in the hex, for the curious: `4c50 4b1a` is `LPK` and `0x1A`, the old end-of-file mark that stops `TYPE` from printing the binary.

## DOS screens are drawn on Linux first and must match

Screens are flattened when the installer is built. Each layout becomes 80 by 25 cells, a code page 437 character and a colour attribute each, with art snapped to the 16 VGA colours. The DOS runtime has no layout engine at all: it unpacks the cells and draws the live widgets on top.

That makes the screens testable on Linux. The host tests draw them and keep the results as text "goldens", and on DOS, `LI_DUMP=D:\DUMP.TXT` makes `SETUP.EXE` write every screen it shows to a file. The top of the welcome golden:

```text
 Lieutenant Fizz - Episode One  Setup                         Liminal Installer
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░Lt. Fizz░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░▄▀▀▀▀▄░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░████▀█░░░░░░░░░░░░╔══════════════════════ Welcome ═══════════════════════╗░░░░
░░██████░░░░░░░░░░░░║ Welcome to the Lieutenant Fizz setup.                ║  ░░
```

`dos/tools/e2e.sh` runs the install under headless DOSBox and compares the welcome, components and copying screens with their goldens character for character. The `░` is the dotted blue in the screenshot: byte `B0`, light blue on blue.

![The copying screen: copying LEVELS\EP1.PAL, a billboard introducing Ben, and three progress meters at 100, 60 and 100 percent](/blog/rust-on-dos/setup-copying.png)
*Copying, slowed to 3,000 DOSBox cycles so it lasted long enough to photograph. "Overall progre" is cut short by the layout on the host too, so the goldens agree on the truncation.*

![A DOS prompt showing a wide directory listing of C:\LTFIZZ and the INSTALL.LIR receipt: product, version, target, folder, components, and lines for each directory, file with size and CRC-32, INI file and launcher](/blog/rust-on-dos/setup-installed-receipt.png)
*After setup: the install folder and its `INSTALL.LIR` receipt. Uninstall reads the receipt and removes files in reverse order, so anything you added to the folder stays.*

Quill, a small word processor that Liminal HQ is building for DOS and early Windows from one Rust core, pushes the same idea further. Its DOS editor, `QUILLDOS.EXE`, is played from recorded keystrokes in headless DOSBox, and every screen it shows is read back from video memory and compared with the host's: 558 screens across 11 scenarios, characters and colours, plus the saved files byte for byte.

![Quill's DOS editor showing a letter in text mode: bold in bright white, italic in cyan, underline in magenta, a price list with dot leaders, and shaded blocks in place of curly quotes](/blog/rust-on-dos/quill-letter-dos.png)
*`QUILLDOS.EXE LETTER.RTF` in DOSBox-X. The shaded blocks are where code page 437 has no curly quote.*

Quill also has a written proposal to become a Desk application, reading its documents through Desk's file calls. It's a plan for now: none of that code exists yet in either project.

## What the DOS installer still can't do

Some of these are choices and some aren't built yet:

- It installs and uninstalls, and that's all. The "Launch after setup" box is drawn, but no DOS exec call sits behind it. Repair would be a modest job, since the receipt already holds every file's CRC.
- The pack format spans disks and the build can write a set, but `SETUP.EXE` reads only volume 1, so a project still has to fit one 1.44 MB floppy. The example leaves 1,316,864 bytes free.
- No Lua. The modern runtimes run Lua hooks; on DOS a step may only name a built-in such as `detect-sound`.
- It needs a 386 or later, DOS 5 and about 2 MB of extended memory: the 256 KiB stack, the compiled project, one 32 KiB chunk and small buffers.
- Only DOSBox has run it. No real 486, no EMM386 or QEMM, no Windows 9x DOS box, and nobody has measured the tick rate against a real timer chip.

## Try it

Everything here is in public repositories. [liminal-hq/desk](https://github.com/liminal-hq/desk) holds the target, runtime, packer and harness in `dos/`, with the full spike report, failures included, in `docs/D0-RUST-DOS.md`. In [liminal-hq-labs/liminal-installer](https://github.com/liminal-hq-labs/liminal-installer), `make dos` fetches the tools, builds `SETUP.EXE` and installs Lieutenant Fizz under headless DOSBox; `docs/retro-dos.md` describes the runtime and `docs/lpk-format.md` the pack. The game is [ScottMorris/lieutenant-fizz-2](https://github.com/ScottMorris/lieutenant-fizz-2).

You need `rustup` with `rust-src` (the toolchain file asks for it), Python 3, and `curl`, `tar` and `xz` for the fetch scripts. You don't need a C compiler.

## Credits

This rests on other people's work, some of it three decades old. **DJGPP**, by DJ Delorie and its contributors, defined the go32 format and wrote the stub every program here starts with. **CWSDPMI**, by Charles W. Sandmann, is the DPMI host inside `SETUP.EXE`.

**DOSBox Staging** made headless, scriptable DOS testing possible, and **js-dos** took the same programs into a browser. Part 2 leans on **Open Watcom** as its reference.

## Next

`rustc --print target-list` still lists no DOS. It doesn't need to. A page of JSON and a runtime of a few thousand lines were enough to get the installer at the top of this post onto drive C:.

[Part 2](/blog/rust-on-windows-3-1) drops to 16 bits for Windows 3.1, where there's no flat address space to hide in and Windows changes registers behind the program's back. [Part 3](/blog/rust-on-windows-9x) comes back up to 32 bits for Windows 95, 98 and Me.
