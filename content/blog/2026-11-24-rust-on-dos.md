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

> **In this series: Cross-compiling to the past.** One portable Rust core, built on a modern Linux PC, carried to three old platforms. Quill, a small word processor built the same way, turns up along the way.
>
> 1. **Rust on DOS** (this post): a 32-bit protected-mode runtime, a packer, and a DOS installer.
> 2. [Rust on Windows 3.1](/blog/rust-on-windows-3-1): 16-bit code, a hand-built NE executable, and a crash that arrives with the timer.
> 3. [Rust on Windows 95, 98 and Me](/blog/rust-on-windows-9x): why "any Win32 program" doesn't include Rust's, and what it takes to change that.

Rust has never heard of DOS. Ask the compiler for its list of targets and you get a few hundred, none of them DOS. Yet the installer in this screenshot is a Rust program running on DOS, and together with the game it installs, it fits on one 1.44 MB floppy disk with 1.3 MB to spare.

![The installer's welcome screen in DOS text mode: a cyan title bar, a soda-can icon in block art, and a dialog welcoming the user to the Lieutenant Fizz setup](/blog/rust-on-dos/setup-welcome.png)
*`SETUP.EXE` from the [Liminal Installer](https://github.com/liminal-hq-labs/liminal-installer), running under DOSBox Staging.*

It was built by **cross-compiling**: compiling on one kind of machine for another, here a 2026 Linux PC producing a program for a 1990s one, with no C compiler installed. I wanted to know whether that was possible because Liminal HQ has several projects that want to run on old PCs, starting with [Desk](https://github.com/liminal-hq/desk), a calm graphical shell for 486-class machines. This post starts at the screen above and zooms in one layer at a time, then zooms back out to the installer and the pack format it now reads.

## DOS gives a program 640 KiB, unless something lends it more

A plain DOS program runs in **real mode**, the 8086-compatible mode every PC starts in. It gets at most 640 KiB of conventional memory, reached through 16-bit segments. Rust wants a flat 32-bit address space, a heap, and pointers that are plain numbers.

DOS can host that with help from a **DPMI host** (DOS Protected Mode Interface). It's a resident program that switches the CPU into 32-bit protected mode, hands out extended memory, and passes calls such as `INT 21h` (DOS) and `INT 10h` (video BIOS) down to real mode. Programs built with DJGPP, the GNU C compiler for DOS, have worked this way since the mid-1990s, usually with Charles Sandmann's **CWSDPMI** as the host.

A DPMI host works a bit like an embassy. Your program lives under protected-mode law, and when it needs something from DOS or the BIOS, the embassy carries the request across the border. The analogy breaks at the paperwork: CWSDPMI forwards a request as it stands and doesn't translate the pointers in it, and that gap caused the first real bug in the runtime.

The other piece is the **stub**. A DOS `.EXE` has to start life as a real-mode program, so a DJGPP executable begins with a small loader that finds or starts a DPMI host, switches to protected mode, copies the program into memory and jumps to it. Everything after the stub is the 32-bit program, in the file layout DJGPP calls "go32".

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

Each line removes something DOS can't provide. A 486 does floating point in its built-in x87 maths unit and has none of the later instructions that work on several numbers at once (MMX, SSE and friends), so those are all switched off. There's no unwinder, so panics abort, and since nothing on DOS will patch addresses at load time, relocation is static.

Rust ships no precompiled `core` or `alloc` for a target it has never seen, so Cargo builds them from source with `-Zbuild-std`. That flag is unstable, so the build sets `RUSTC_BOOTSTRAP=1` and the pinned Rust 1.98.0 toolchain accepts it. The relevant part of `.cargo/config.toml`:

```toml
[unstable]
build-std = ["core", "alloc", "compiler_builtins"]
build-std-features = ["compiler-builtins-mem"]
json-target-spec = true

[build]
target = "dos-elf.json"
```

`compiler-builtins-mem` supplies `memcpy` and friends, which normally come from the C library this project doesn't have. The linker is `rust-lld`, which ships with Rust. Its script starts the program at `0x1000`, so a null pointer lands in 4 KiB of nothing, and aligns each section to 512 bytes because the stub reads the file in disk sectors.

`cargo build --release` then produces a static ELF executable, the standard program format on Linux. It's perfectly ordinary, and no DOS machine can run it.

## The stub trusts the file's header and checks only its first two bytes

DJGPP's own linker writes go32 files directly, but using it would bring back the GNU toolchain I was trying to leave. Desk has `dos/tools/elf2go32.py` instead, a 139-line Python script with no dependencies that rearranges the ELF file into what the stub expects.

![How the stub loads the program: on disk, the stub, a 168-byte header, then code and data; in memory, conventional memory below 1 MiB, CWSDPMI, and a block holding the program's code, data, stack and heap](/blog/rust-on-dos/loader-memory.svg)
*How the stub loads a program, drawn from an earlier 160,768-byte build of `SETUP.EXE`. The block's base address is wherever CWSDPMI put it.*

To learn what the stub needs, I disassembled it (DJGPP's `stubify -g` writes it out) and checked each guess by running the result. It reads a 168-byte header from right after itself and believes nearly all of it. The only bytes it checks are the first two, the "magic number" `0x014C` that marks the file type.

The rest of the header says where things go. The entry point is a plain offset, each section is copied in 512-byte reads, the zero-filled `.bss` section is cleared by the stub, and the memory block is the end of `.bss` rounded up to 64 KiB, and never less than 128 KiB. There are no symbols or relocations to write, because `rust-lld` has already resolved every one.

> **The header, byte by byte.** The 168 bytes are three old Unix formats stacked together: a COFF file header (20 bytes), an a.out header (28 bytes) and three 40-byte section headers for `.text` (code), `.data` and `.bss`. From the same earlier build:
>
> ```text
> 00005800: 4c01 0300 0000 0000 0000 0000 0000 0000  L...............
> 00005810: 1c00 0701 0b01 0000 0018 0200 0002 0000  ................
> 00005820: 0002 0400 0010 0000 0010 0000 0028 0200  .............(..
> 00005830: 2e74 6578 7400 0000 0010 0000 0010 0000  .text...........
> ```
>
> `4c01` is the magic, `0300` is three sections, `1c00` is the 28-byte a.out header, and `0010 0000` is the entry point, `0x1000`.

The stub is the one piece still borrowed. Desk uses DJGPP's 2 KiB `STUB.EXE` and ships `CWSDPMI.EXE` beside each program. The installer uses `CWSDSTUB.EXE` from the CWSDPMI package, a 22,528-byte stub with the DPMI host built in, so `SETUP.EXE` runs as a single file on a machine with no host at all. Without either, the stub prints `Load error: no DPMI - Get csdpmi*b.zip` and exits, which is still good advice.

## The runtime does what `std` would have done

A `no_std` program has no allocator and no way to print, and nothing calls its `main`. Desk's `rt` crate is the language runtime that supplies those, in about 2,300 lines, a fair share of them comments explaining why.

The entry point, `_start`, is written in assembly. The stub hands over an odd machine: a stack a few hundred bytes deep and the stub's own data in the `FS` segment register. So `_start` copies that data out, moves to a 256 KiB stack, resets the x87, and calls Rust. It never returns, and the instruction after the call is `ud2`, an instruction that exists to crash. (A test program that returned anyway jumped into whatever the stub had left on its stack, and DOSBox stopped with a page fault.)

The first Rust code to run is the DPMI client. The stub's data segment covers only the program's own block, but heap memory from DPMI lands elsewhere. So `dpmi::init` stretches the data segment's limit to 4 GiB and reloads it, after which any address in the machine is one pointer away, including the first megabyte with the BIOS data area and video memory. DJGPP programs call this the near-pointer trick.

Then came the bug the embassy analogy promised. My first `hello` printed 460 NUL bytes. A protected-mode pointer means nothing in real mode, and CWSDPMI r7 forwards `INT 21h` with the registers untouched, so DOS read whatever sat at that address in real-mode memory. The fix is what DJGPP's C library does: a 32 KiB transfer buffer below 1 MiB, data copied in and out, and every pointer-taking call made through DPMI's "simulate real-mode interrupt" service.

![Eight lines of DOS output: DPMI checks, a direct INT 21h call reporting false, and 300,000-byte file writes and reads that match](/blog/rust-on-dos/desk-hello-transcript.png)
*The end of Desk's own `HELLO.EXE` transcript (a 71,168-byte test program, not the installer). The `false` on the direct `INT 21h` line is deliberate: it's the evidence for the transfer buffer.*

The rest is smaller: a first-fit heap behind `#[global_allocator]` so `Vec`, `String` and `format!` work, arguments from the PSP (the block DOS puts in front of every program), x87 `sqrt` and `atan2` (which `core` lacks), and a panic path that unhooks interrupts before it prints anything. A DOS program that leaves the timer interrupt pointing into freed memory takes the next program down with it.

## The CPU floor is a 486 by test and a 386 only on paper

My first CPU exception was on `CMPXCHG`, the instruction Rust emits for an atomic compare-and-swap. A real 486 has it from the B stepping on, but DOSBox with `cputype = 486` faults on it and runs it fine under its Pentium setting. I don't know why DOSBox's 486 model leaves it out. The runtime is single-threaded, so it now uses plain loads and stores, and every test keeps DOSBox at its strict 486 setting so any stray atomic shows up at once.

That leaves two different floors. The installer's documentation names a 386, and the runtime avoids `CMPXCHG` for that reason. But the target says `i486`, so the compiler is free to use other 486-only instructions such as `BSWAP`, and nothing in the build checks for them. What has actually been tested is DOSBox at its 486 setting, and nothing has run on a real 386 or 486.

## Testing a DOS program from Linux needs a generated 255-line ladder

Every DOS program here runs headless under DOSBox Staging through `dosrun.sh`. It mounts a folder as `C:`, runs the program from a generated batch file with output redirected to `D:`, starts DOSBox with SDL's dummy video and audio drivers, and returns the output and exit status as if the program were a local command.

The exit status was the awkward part. DOS has no way to hand one to its host, and DOSBox Staging doesn't expand `%ERRORLEVEL%`. So the script writes a ladder of 255 lines, `if errorlevel 1 set RC=1` up to `if errorlevel 255 set RC=255`, and because `IF ERRORLEVEL n` is true for every `n` up to the status, the last match wins. It's the least elegant code in the project.

From the shell, a DOS program then looks like any other:

```bash
$ dos/tools/dosrun.sh desk HELLO.EXE | head -3
D0-HELLO ok
args: 0 []
comspec: true
```

That's what lets DOS programs sit in an ordinary test suite. Each example has a recorded transcript, and the check fails on a single changed byte.

## Three Liminal HQ projects ended up with the same shape

Desk came first. Its `SHELL.EXE` adds drivers for the keyboard, the mouse and VGA and VESA graphics (the standard video modes of the period) under a small hardware abstraction layer, a set of traits that hide the machine. The rule that keeps it manageable is checked on every run: the shell crates make no DOS calls and depend on that layer and nothing else.

Lieutenant Fizz 2 is the second, a Keen-style platformer. Its rules and drawing code step at a fixed 60 Hz and hash the game state every tick, and a native build, a WebAssembly build and the DOS build must agree on the hash after the same scripted replay: `PARITY ok ec9195c222b626f2`. The third is the installer, which the rest of this post covers.

![Lieutenant Fizz 2 running on DOS: the hero on a wooden walkway at night beside red brick towers, with a score bar at the top](/blog/rust-on-dos/fizz2-dos-replay.png)
*`FIZZ2.EXE /REPLAY` in DOSBox Staging, partway through the scripted run.*

![Three projects, one shape: portable no_std cores at the top, a trait seam in the middle, DOS and other platforms at the bottom](/blog/rust-on-dos/core-and-platform.svg)
*The pattern all three projects settled on. When something breaks on DOS, the search is through a few thousand lines of platform code instead of the whole program.*

The shape paid off once already. Desk's `s5-jsdos` spike ran its DOS programs unchanged in a browser through js-dos, a DOSBox that runs in a web page, and their transcripts matched the native harness byte for byte (see `docs/S5-JSDOS.md` in Desk).

## The installer reads a pack built for floppies

The Liminal Installer builds installers for many systems from one project. Its `dos/` folder is a copy of Desk's target, linker script, packer, harness and the parts of `rt` it needs, with every change listed in `dos/PROVENANCE.md`. A project names a DOS target like any other:

```toml
id       = "dos-x86"
renderer = "tui-retro"
theme    = "fizz-dos"
outputs  = ["floppy-1440", "zip"]
```

Inside, the shape repeats. `li-retro` is the portable core: the compiled project format, a small bytecode VM for conditions, the flow VM that walks the install steps, a text renderer and the install engine, behind a `Platform` trait. On DOS, the 553 lines of `dos/setup` write characters straight into text-mode video memory at `B8000h`, read keys from the BIOS and call `rt` for files.

The installer keeps its files in `SETUP.LPK`, a **Liminal Pack**: one format meant for the DOS, Windows 3.1 and Windows 95 installers alike. Building the example project and listing its pack:

```text
$ liminst build -t dos-x86 --version 1.0.0 --dos-runtime dos/dist/SETUP.EXE -o out
files: out/dos (SETUP.EXE, SETUP.LPK and README.TXT; 175 bytes installed from a 3494-byte pack)
$ liminst lpk list out/dos/SETUP.LPK
6 files, 12284 bytes, 1 volume, chunks of 32768 bytes, set e737e0b1
     12109 72299a5e ---- 1980-01-01 00:00 v1 SETUP.PRJ
        34 7b25e07a ---- 1980-01-01 00:00 v1 FIZZ.EXE
        35 223b7573 ---- 1980-01-01 00:00 v1 LEVELS/EP1.LVL
```

The first entry, `SETUP.PRJ`, is the compiled project; the rest are the game's files (stand-ins, so this is a real install of a pretend game). The columns are size, a checksum, attributes, date and the disk it's on.

![The layout of a Liminal Pack across two disks: SETUP.LPK holds a header, the directory, chunks, a next-disk marker and a footer; SETUP.L02 holds a header, chunks and a footer](/blog/rust-on-dos/lpk-layout.svg)
*A Liminal Pack, from `docs/lpk-format.md` in the installer repository. The header starts with `LPK` and byte `1A`, the old end-of-file mark that stops DOS's `TYPE` from printing the binary.*

Each choice in the format comes from an old machine's limit. Files are cut into chunks of at most 32 KiB, and each chunk is compressed on its own with DEFLATE, the method inside every zip file. A 16-bit Windows program can't allocate a buffer bigger than one 64 KiB segment, and with independent chunks the reader needs only one decoded chunk and a 256-byte read buffer. The cost, measured on 197 KB of the repository's documents and 3 MB of an executable, is 7.3% more compressed size on the text and 2.7% on the executable.

Every file has an upper-case **8.3 name** (eight characters, a dot, three more), the only kind DOS can create, and may carry a long name for systems that have them. Every file and chunk has a CRC-32 checksum, the same kind the install receipt and `zip -T` use, and the tests flip every bit of a pack to show each flip is caught. A pack can also span disks as `SETUP.LPK`, `SETUP.L02` and onward, with no chunk ever split between two of them.

> **One file, four sizes.** The pack's reader is `no_std`, allocates nothing and uses no `unsafe`, and it replaced the `miniz_oxide` decompressor that read the old `SETUP.DAT`, which needs a heap and a 32 KiB state of its own. Then a hand-written project decoder replaced `serde`'s generated one. The DOS `SETUP.EXE` at each step:
>
> | Build | Bytes | Where |
> |---|---|---|
> | An earlier build (as drawn above) | 160,768 | the first DOS installer |
> | `SETUP.DAT` and `miniz_oxide` | 161,280 | main, before PR #30 |
> | `SETUP.LPK` and the pack's own reader | 153,088 | main today |
> | With the hand-written decoder | 136,704 | the Windows 3.1 branch, PR #36 |
>
> The same decoder change saves code in the Windows 3.1 and Windows 95 runtimes too; [Part 2](/blog/rust-on-windows-3-1) has those numbers.

## DOS screens are drawn on Linux first and must match

Screens are flattened when the installer is built. Each layout becomes 80 by 25 character cells, each a character from code page 437 (the IBM PC's character set, box-drawing and block characters included) and a colour, with art snapped to the 16 VGA colours. The DOS program has no layout engine at all: it unpacks the cells and draws the live widgets on top.

That makes the screens testable on Linux. The host tests draw them and keep the results as text "goldens", and on DOS, `LI_DUMP=D:\DUMP.TXT` makes `SETUP.EXE` write every screen it shows to a file. The top of the welcome golden:

```text
 Lieutenant Fizz - Episode One  Setup                         Liminal Installer
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░Lt. Fizz░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░▄▀▀▀▀▄░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░████▀█░░░░░░░░░░░░╔══════════════════════ Welcome ═══════════════════════╗░░░░
░░██████░░░░░░░░░░░░║ Welcome to the Lieutenant Fizz setup.                ║  ░░
```

`dos/tools/e2e.sh` runs the install under headless DOSBox Staging and compares the welcome, components and copying screens with their goldens character for character. The `░` is the dotted blue in the screenshot: byte `B0`, light blue on blue.

![The copying screen: copying LEVELS\EP1.PAL, a billboard introducing the hero, and three progress meters](/blog/rust-on-dos/setup-copying.png)
*Copying, slowed to 3,000 DOSBox cycles so it lasted long enough to photograph. "Overall progre" is cut short by the layout on the host too, so the goldens agree on the truncation.*

![A DOS prompt showing the C:\LTFIZZ folder and the INSTALL.LIR receipt, with a line per directory and per file with its size and CRC-32](/blog/rust-on-dos/setup-installed-receipt.png)
*After setup: the install folder and its `INSTALL.LIR` receipt. Uninstall reads the receipt and removes files in reverse order, so anything you added to the folder stays.*

Quill pushes the same idea further: its DOS editor is played from recorded keystrokes in headless DOSBox, and 674 screens across 12 scenarios are compared with the host's, characters and colours, along with the saved files.

## Limits and what hasn't been tested

Some of these are choices and some aren't built yet:

- It installs and uninstalls, and that's all. The "Launch after setup" box is drawn, but no DOS exec call sits behind it. Repair would be a modest job, since the receipt already holds every file's CRC.
- The pack format spans disks and the build can write a set, but `SETUP.EXE` reads only the first disk, so a project still has to fit one 1.44 MB floppy.
- No scripts. The modern runtimes run Lua hooks; on DOS a step may only name a built-in such as `detect-sound`.
- It needs DOS 5 and about 2 MB of extended memory: the 256 KiB stack, the compiled project, one 32 KiB chunk and small buffers. The CPU floor is a 486 by test and a 386 only on paper, as above.
- Only DOSBox Staging has run the installer. No real 386 or 486, no EMM386 or QEMM, no Windows 9x DOS box, and nobody has measured the tick rate against a real timer chip.

## Try it

Everything here is in public repositories. [liminal-hq/desk](https://github.com/liminal-hq/desk) holds the target, runtime, packer and harness in `dos/`, with the full spike report, failures included, in `docs/D0-RUST-DOS.md`. In [liminal-hq-labs/liminal-installer](https://github.com/liminal-hq-labs/liminal-installer), `make dos` fetches the tools, builds `SETUP.EXE` and installs Lieutenant Fizz under headless DOSBox; `docs/retro-dos.md` describes the runtime and `docs/lpk-format.md` the pack. The game is [ScottMorris/lieutenant-fizz-2](https://github.com/ScottMorris/lieutenant-fizz-2).

You need `rustup` with `rust-src` (the toolchain file asks for it), Python 3, and `curl`, `tar` and `xz` for the fetch scripts. You don't need a C compiler.

## Credits

This rests on other people's work, some of it three decades old. **DJGPP**, by DJ Delorie and its contributors, defined the go32 format and wrote the stub every program here starts with. **CWSDPMI**, by Charles W. Sandmann, is the DPMI host inside `SETUP.EXE`.

**DOSBox Staging** made headless, scriptable DOS testing possible, and **js-dos** took the same programs into a browser.

## Next

The installer from the top of this post ends up as three files on a floppy: a 136,704-byte `SETUP.EXE`, a 3,494-byte pack and a README, with 1,316,864 bytes still free. Rust never learned DOS. It was told what CPU to emit code for, and a few thousand lines of runtime told it what to expect from the machine.

[Part 2](/blog/rust-on-windows-3-1) drops to 16 bits for Windows 3.1, where there's no flat address space to hide in and Windows changes registers behind the program's back. [Part 3](/blog/rust-on-windows-9x) comes back up to 32 bits for Windows 95, 98 and Me.
