---
title: "Cross-compiling to the past, part 1: Rust on DOS"
date: "2026-11-24"
slug: "rust-on-dos"
excerpt: "Rust has no DOS target. We built one anyway: a freestanding i486 target, a hand-written DPMI client, a 139-line packer and a headless DOSBox harness. Then we used it to ship a real DOS installer."
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
> 2. [Rust on Windows 3.1](/blog/rust-on-windows-3-1): the 16-bit Win16 work.
> 3. [Rust on Windows 9x](/blog/rust-on-windows-9x): 32-bit Windows 95, 98 and Me.

Ask `rustc --print target-list` for DOS and it will politely list a few hundred targets, none of them DOS. That's fair. MS-DOS 6.22 shipped in 1994, and a compiler maintained in 2026 owes it nothing.

We wanted it anyway. Liminal HQ's [Desk](https://github.com/liminal-hq/desk) project is a calm graphical shell for 486-class PCs, and its first question was whether a DOS program could be pure Rust: no `gcc`, no C library, no `crt0`, built on a modern Linux machine with tools we control, and run headless in an emulator so it can be tested like any other code. The answer was yes. This post is how, what broke along the way, and how the same foundation now builds `SETUP.EXE` for the [Liminal Installer](https://github.com/liminal-hq-labs/liminal-installer).

The toolchain is Rust 1.98.0, released in August 2026, compiling edition 2021 and 2024 crates for a CPU Intel introduced in 1989. The language itself needed no changes. The work was all in the build, the loader and the runtime.

## What a DOS program has to be

A real-mode DOS program gets at most 640 KiB of conventional memory, addressed in 16-bit segments. Rust does not want to live there. It wants a flat 32-bit address space, a heap, and pointers that are just numbers.

DOS can host that, with help. A 32-bit protected-mode program runs under a **DPMI host** (DOS Protected Mode Interface), a resident program that switches the CPU into protected mode, hands out extended memory through `INT 31h`, and passes calls such as `INT 21h` (DOS) and `INT 10h` (video BIOS) down to real mode. DJGPP programs have worked this way since the mid-1990s, usually with Charles Sandmann's **CWSDPMI** as the host.

The other half is the **stub**. A DOS `.EXE` must start as a real-mode MZ program, so DJGPP executables begin with a 2 KiB loader that finds or starts a DPMI host, switches to protected mode, copies the program into a block of memory, and jumps to it. The bytes after the stub are a COFF image in DJGPP's "go32" format.

So the job splits in three: get Rust to emit 32-bit x86 code for no operating system, wrap it in a COFF image the stub accepts, and write a runtime that makes the machine look like somewhere Rust can live.

## A target that Rust does not ship

Rust has no `i486-pc-msdos`, but it does accept a target described in JSON. Desk's is `dos/dos-elf.json`:

```json
{
  "llvm-target": "i486-unknown-none-elf",
  "arch": "x86",
  "os": "none",
  "cpu": "i486",
  "features": "-mmx,-sse,-sse2,-sse3,-ssse3,-sse4.1,-sse4.2,-avx",
  "panic-strategy": "abort",
  "relocation-model": "static",
  "disable-redzone": true,
  "linker": "rust-lld",
  "linker-flavor": "ld.lld",
  "executables": true
}
```

That is trimmed; the real file also spells out the data layout. It is a freestanding ELF target. The CPU is an i486, floating point is x87 hardware, and every SIMD extension is switched off because a 486 has none. Panics abort, because there is no unwinder. Relocation is static, because nothing on DOS will ever patch an address at load time.

Rust ships no precompiled `core` or `alloc` for a target it has never heard of, so Cargo builds them from source. That is an unstable option, so the build scripts set `RUSTC_BOOTSTRAP=1` and the pinned stable toolchain accepts it. The whole configuration fits in `.cargo/config.toml`:

```toml
[unstable]
build-std = ["core", "alloc", "compiler_builtins"]
build-std-features = ["compiler-builtins-mem"]
json-target-spec = true

[build]
target = "dos-elf.json"

[target.dos-elf]
rustflags = ["-C", "link-arg=-Tlink.ld", "-C", "link-arg=-nostdlib",
             "-C", "link-arg=-static", "-C", "relocation-model=static"]
```

`compiler-builtins-mem` supplies `memcpy` and friends, which would normally come from the C library we no longer have. The linker is `rust-lld`, shipped with the toolchain. Its script, `link.ld`, starts the image at offset `0x1000` (the empty first 4 KiB give a null pointer somewhere harmless to land), puts each section on a 512-byte boundary because the stub reads the file in sectors, and discards `.eh_frame`.

The build is one command, run from the `dos/` directory:

```bash
RUSTC_BOOTSTRAP=1 cargo build --release --locked
```

What comes out is a perfectly ordinary static ELF executable that no DOS machine can run.

![The build pipeline: Rust crates, compiled with -Zbuild-std for dos-elf.json, linked by rust-lld with link.ld into a static ELF, packed by elf2go32.py behind the CWSDSTUB.EXE stub into SETUP.EXE, loaded by DOS](/blog/rust-on-dos/build-pipeline.svg)
*From Rust source to `SETUP.EXE`. The sizes are from the installer build used for this post.*

## The packer: 139 lines of byte shuffling

DJGPP's own linker writes go32 executables directly, but it would bring back the GNU toolchain we were leaving. So Desk has `dos/tools/elf2go32.py`, a dependency-free Python script.

The stub's requirements were found by disassembling it (DJGPP's `stubify -g` writes it out) and confirmed by running the results. They are short:

- The 168 bytes after the stub hold exactly a COFF file header (20 bytes), an a.out header (28 bytes) and three section headers (40 bytes each) named `.text`, `.data` and `.bss`, in that order. Of all those bytes, the stub checks only the magic number `0x014C`.
- The entry point is a plain offset in the a.out header.
- Each section is copied from its file offset to its address in 512-byte reads, so the file offsets should be multiples of 512.
- `.bss` is zeroed by the stub.
- The memory block is the end of `.bss` rounded up to 64 KiB, and at least 128 KiB.

There are no symbols, no relocations and no line numbers, because `rust-lld` has already resolved every one of them. The packer reads the ELF program headers, makes the first loadable segment `.text` and the second `.data` plus `.bss`, writes the three headers, pads, and appends. Its `--info` flag says what it did:

```text
$ elf2go32.py --info CWSDSTUB.EXE target/dos-elf/release/setup SETUP.EXE
elf2go32: SETUP.EXE: stub 22528 + coff 138240 = 160768 bytes; text 0x1000+0x21800,
  data 0x22800+0x200, bss 0x22a00+0x40200, entry 0x1000, block 448 KiB
```

And the first bytes after the stub are exactly what the stub asked for:

```text
00005800: 4c01 0300 0000 0000 0000 0000 0000 0000  L...............
00005810: 1c00 0701 0b01 0000 0018 0200 0002 0000  ................
00005820: 0002 0400 0010 0000 0010 0000 0028 0200  .............(..
00005830: 2e74 6578 7400 0000 0010 0000 0010 0000  .text...........
```

`4c01` is the magic, `0300` is three sections, `1c00` is the 28-byte a.out header, and `0010 0000` is the entry point, `0x1000`. It is satisfying to read a file format by eye and find nothing in it you did not put there.

The stub itself is the one piece we still borrow. Desk uses DJGPP's 2 KiB `STUB.EXE` and ships `CWSDPMI.EXE` beside each program. The packer also accepts `CWSDSTUB.EXE` from the CWSDPMI package, a 22,528-byte stub with the DPMI host built in, which makes a single file that runs on a machine with no DPMI host at all. Without either, the stub prints `Load error: no DPMI - Get csdpmi*b.zip` and exits with status 110, which is still good advice.

## The runtime: everything `std` would have done

A `no_std` program has no `main` in the usual sense, no allocator and no way to print. Desk's `rt` crate supplies those in about 2,300 lines, a fair share of them comments explaining why.

**`_start`** is written in `global_asm!`. The stub hands over a strange machine: `CS` and `DS` cover the image's block, `FS` points at the stub's own data (where DJGPP's `_GO32_StubInfo` block lives), and the stack is the stub's, a few hundred bytes deep. `_start` saves every register for inspection, clears the direction flag, copies the 0x54-byte stub information out of `FS:0`, moves to a 256 KiB stack in `.bss`, runs `FNINIT` so the x87 starts from a known state, and calls Rust. It never returns; the instruction after the call is `ud2`. (A test program whose entry is a bare `ret` jumps into whatever the stub left on its stack, and DOSBox stops with a page fault. We checked.)

**The DPMI client** comes first in Rust. The stub's data selector covers only the image's block, but heap memory from DPMI function 0501h lands elsewhere in the linear address space. So `dpmi::init` raises the limit of `DS` to 4 GiB with function 0008h and reloads `DS`, `ES` and `SS`. After that, any linear address `L` is reachable at `DS:(L − base)`, wrapping around. The first megabyte, which CWSDPMI maps at linear 0, comes along for free, so the PSP, the BIOS data area and VGA memory are one pointer away. It is the same near-pointer trick DJGPP programs use.

**DOS calls** go through `INT 21h`, with a catch. The first `hello` printed 460 NUL bytes. A probe that printed memory instead got CWSDPMI's own error strings. CWSDPMI r7 reflects a protected-mode `INT 21h` to real mode with the registers untouched, so `DS:DX` points into whatever real-mode segment happens to be loaded, which is the host's. The fix is what DJGPP's C library does: a 32 KiB transfer buffer in conventional memory, data copied in and out, and every pointer-taking call made through DPMI's "simulate real-mode interrupt" (0300h). Larger reads and writes loop over the buffer.

**The heap** is a first-fit free list over DPMI blocks of at least 256 KiB, behind `#[global_allocator]`. `Vec`, `String` and `format!` work, and a 900 MB request on a 16 MB machine fails with Rust's ordinary allocation-failure panic.

**The rest** is smaller: arguments and environment from the PSP, x87 `sqrt`, `sin`, `cos` and `atan2` (which `core` lacks), `print!`, IRQ stubs, a timer hook, VGA mode 13h and a clean-up list. Our first environment read came back as a DOS device header, because the word at `PSP:2Ch` is a protected-mode selector once the host has started.

**The panic path** runs the clean-up list first, so a hooked timer interrupt is off the machine before any formatting happens, then prints `RT PANIC:` with the location and message, and exits with status 3. A panic inside the panic handler exits immediately. A DOS program that leaves IRQ 0 pointing into freed memory takes the next program down with it.

One more surprise came from the emulator. Our first CPU exception was on `CMPXCHG`, which Rust emits for atomic compare-and-swap. A real 486 has the instruction, but DOSBox with `cputype = 486` faults on it. The runtime is single-threaded, so it uses plain loads and stores, and Fizz 2 later banned compare-and-swap in its `clippy.toml`. The strict CPU setting stayed in every test anyway: it catches anything a 486 cannot run.

![A DOS screen showing the hello program's output: allocation, x87 float results, DPMI version 0.90 and vector round trips, and 300,000-byte file reads and writes](/blog/rust-on-dos/desk-hello-transcript.png)
*Desk's `HELLO.EXE` in DOSBox Staging, rebuilt for this post with CWSDPMI inside it (71,168 bytes). The `false` on the direct `INT 21h` line is deliberate: it is the evidence for the transfer buffer.*

![How the stub loads the program: the file holds the stub, a 168-byte COFF header, .text and .data; memory holds conventional memory with the PSP, transfer buffer and VGA, CWSDPMI, and the image block with .text at 0x1000, .data, .bss and the stack, plus heap blocks](/blog/rust-on-dos/loader-memory.svg)
*What the stub does with the file. Offsets are from `SETUP.EXE`; the image block's base is wherever CWSDPMI put it.*

## Testing DOS programs from a Linux shell

Every DOS program here runs headless under **DOSBox Staging** through `dosrun.sh`. It mounts a directory as `C:`, runs the program from a generated batch file with its output redirected to `D:`, starts DOSBox with SDL's dummy video and audio drivers, and hands back the output and exit status as if the program were a local command.

Getting the exit status out is the fun part. DOS has no way to hand one to its host, and DOSBox Staging does not expand `%ERRORLEVEL%`. So the batch file has a ladder of 255 lines, `if errorlevel 1 set RC=1` through `if errorlevel 255 set RC=255`. `IF ERRORLEVEL n` is true for every `n` up to the status, so the last line that matches wins, and the result is written to `D:\EXITCODE.TXT`. It is the least elegant code in the project and it has never been wrong.

```bash
$ dos/tools/dosrun.sh desk HELLO.EXE | head -3
D0-HELLO ok
args: 0 []
comspec: true
```

Each example program has a recorded transcript, and the check fails on a single changed byte. For this post we rebuilt `HELLO.EXE` from a clean clone and diffed its output against `dos/expected/hello.txt`: identical. `HW.EXE` goes further: it hooks IRQ 0 and counts 18 to 20 ticks in about a second, then draws a pattern in mode 13h and checks that video memory reads back with the right checksum.

What a headless check cannot do is look at the screen. For the screenshots in this post we ran the same harness under a virtual X server and grabbed DOSBox's window every 50 milliseconds.

## From hello to Desk to Lieutenant Fizz 2

With the runtime working, Desk moved on to the shell. `SHELL.EXE` uses the same `rt` crate, plus drivers for the keyboard controller, the mouse through `INT 33h`, and VGA and VBE graphics, under a small hardware abstraction layer.

![Desk's shell in DOSBox: two dark windows, Notes and Welcome to Desk, with "hello dos" typed into a text field](/blog/rust-on-dos/desk-first-window.png)
*Desk's `SHELL.EXE` at 640 by 480 in 256 colours. The keys were typed by DOSBox's `AUTOTYPE` through the emulated keyboard controller, so the shell's own IRQ 1 handler read them.*

The rule that made this manageable is in `docs/LAYERS.md` and is checked on every run: the shell crates are `no_std`, make no DOS calls and may depend on the hardware abstraction layer and nothing else. The DOS adapter, `shell/dos`, is where `rt` comes in. A native kernel, booting on its own drivers in QEMU, composes the same shell crates.

Lieutenant Fizz 2, the next episode of Liminal HQ's Keen-style platformer, took the same shape. Its rules and drawing code are `no_std` crates that step at a fixed 60 Hz and hash the game state every tick. A Web presenter compiles them to WebAssembly; a DOS presenter runs them on a runtime mirrored from Desk's, in mode 13h with AdLib and Sound Blaster music. Native, Web and DOS builds play the same scripted replay and must agree on the hash: `PARITY ok ec9195c222b626f2`.

![Lieutenant Fizz 2 running on DOS: Ben on a wooden walkway at night, red brick towers, a green exit door and a HUD reading Fizz 5, Score 00002, Lives 2](/blog/rust-on-dos/fizz2-dos-replay.png)
*`FIZZ2.EXE /REPLAY` in DOSBox Staging, partway through the scripted run. The floating words are the game's captions for its sound effects, which the test harness keeps silent anyway.*

![Three projects, one shape: portable no_std cores at the top, a trait seam in the middle, DOS and other platforms at the bottom](/blog/rust-on-dos/core-and-platform.svg)
*The pattern all three projects settled on. A bug in the DOS layer is a search through a few hundred lines.*

## A real DOS installer

The Liminal Installer builds installers for many targets from one project: a theme, layouts, flows and a file list. Modern targets run its Rust engine; DOS gets `liminst build -t dos-x86` and the Desk foundation. `dos/` in the installer is a copy of Desk's target, linker script, packer, harness and the parts of `rt` it needs, with every file and change listed in `dos/PROVENANCE.md` against Desk commit `4a021a7`.

The project describes a DOS target like any other:

```toml
id       = "dos-x86"
renderer = "tui-retro"
theme    = "fizz-dos"
outputs  = ["floppy-1440", "zip"]
```

The design follows the pattern above. `li-retro` is the portable core, 3,668 lines of `no_std` plus `alloc`: the compiled project format, a bytecode VM for `when` conditions, the flow VM that walks the install steps, a text renderer and the install engine, all behind a `Platform` trait for the screen, keys, files and clock. The tests run it on the host against `HostPlatform`. On DOS, `dos/setup` is the thin crate: 553 lines that write cells to text memory at `B8000h`, read keys from the BIOS and call `rt::dos` for files.

The build has three outputs:

```text
$ liminst build -t dos-x86 --version 1.0.0 --dos-runtime dos/dist/SETUP.EXE
files: out/dos (SETUP.EXE, SETUP.DAT and README.TXT; 175 bytes installed from 175 compressed)
floppy-1440: out/lt-fizz-1.0.0-dos-x86-1440.img
zip: out/lt-fizz-1.0.0-dos-x86.zip
```

`SETUP.EXE` is the same 160,768 bytes for every project. `SETUP.DAT` is the project: an eight-byte magic, four little-endian offsets and lengths, a [`postcard`](https://docs.rs/postcard) encoding of the compiled project, then each file, stored or raw deflate:

```text
00000000: 4c49 5244 4154 3100 1800 0000 5d2f 0000  LIRDAT1.....]/..
```

The floppy image is a real FAT12 file system written by the installer's own code (`file` reports 2,880 sectors, 224 root entries, label `LTFIZZ`), and `mdir` lists the three files with 1,283,584 bytes to spare. The 175-byte payload is honest: the example project installs stand-in files, so what follows is a real install of a pretend game.

Screens are flattened at build time. Each layout becomes 80 by 25 cells, a code page 437 byte and a VGA attribute each, in the Fizz-DOS artboard look: cyan title bar, side column with block art, a double-bordered dialog with a drop shadow, and a hint bar with red keys. Art pixels snap to the nearest of the 16 VGA colours, two pixel rows to a text row through half blocks (`▀ ▄ █`). The runtime has no layout engine. It unpacks the cells and draws the live widgets over them.

![The installer's welcome screen in DOS text mode: a cyan title bar, a blue dotted background, a soda-can block-art icon with Step 1 of 8, and a grey dialog welcoming the user to the Lieutenant Fizz setup](/blog/rust-on-dos/setup-welcome.png)
*`SETUP.EXE` under DOSBox Staging: the welcome screen.*

![The components screen: three ticked components, Game program, Sound drivers and Episode one levels, with space required 3 KB and 64.0 MB free](/blog/rust-on-dos/setup-components.png)
*Step 4 of 8. The `-freesize 64` on DOSBox's mount is where the 64.0 MB comes from.*

![The copying screen: copying LEVELS\EP1.PAL, a billboard introducing Ben, and three progress meters at 100, 60 and 100 percent](/blog/rust-on-dos/setup-copying.png)
*Copying, slowed down by setting DOSBox to 3,000 cycles so it lasted long enough to photograph. "Overall progre" is cut short by the layout on the host too, so the goldens agree on the typo-shaped truncation.*

The same screens are drawn on the host in the tests and kept as text "goldens". On DOS, `LI_DUMP=D:\DUMP.TXT` makes `SETUP.EXE` append every screen it shows to a file, so the two can be compared. The top of the welcome golden:

```text
 Lieutenant Fizz - Episode One  Setup                         Liminal Installer
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░Lt. Fizz░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░Episode One░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░▄▀▀▀▀▄░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░████▀█░░░░░░░░░░░░╔══════════════════════ Welcome ═══════════════════════╗░░░░
░░██████░░░░░░░░░░░░║ Welcome to the Lieutenant Fizz setup.                ║  ░░
```

For the run in this post, the welcome, components, copying and finished screens in the DOS dump matched their host goldens character for character. The `░` in the golden is the dotted blue you see in DOSBox: CP437 byte `B0`, light blue on blue (attribute `0x19`).

![The final setup screen: Lt. Fizz is installed, with an unticked Launch Lieutenant Fizz box and a Finish button](/blog/rust-on-dos/setup-done.png)
*Step 8 of 8. The "Launch" box is drawn but does nothing yet; more on that below.*

![A DOS prompt showing a wide directory listing of C:\LTFIZZ and the INSTALL.LIR receipt: product, version, target, folder, components, and lines for each directory, file with size and CRC-32, INI file and launcher](/blog/rust-on-dos/setup-installed-receipt.png)
*After setup: `DIR /W` and `TYPE INSTALL.LIR` in a fresh DOSBox session. Uninstall reads this receipt and removes files in reverse order, so anything you added to the folder stays.*

The receipt records CRC-32 rather than SHA-256, because a 386 has better things to do than hash every file. There is no journal: a cancel or a failure removes exactly what this run created, in reverse.

## What it does not do

Some of these are choices and some are simply not built yet.

- **No repair, modify, update or launch.** Install and uninstall only. The "Launch after setup" box is drawn, but there is no DOS exec call behind it. Repair would be straightforward, since the receipt already has the CRCs.
- **No disk spanning.** Everything must fit one 1.44 MB disk. When it does not, the build says how many bytes over it is and builds only the zip.
- **No Lua on DOS.** The modern runtimes run Lua hooks; on DOS a step may only name a built-in such as `detect-sound`. An interpreter would cost more memory and floppy space than the rest of the runtime.
- **A 386 or later, with extended memory.** `SETUP.EXE` needs DOS 5 or later and about 2 MB of extended memory: the 256 KiB stack, the compiled project, a 32 KiB inflate window and small buffers. An 8088 or a 286 will not run it.
- **Only DOSBox Staging has run the DOS builds.** No real 486, no EMM386 or QEMM, no Windows 9x DOS box. The tick rate has not been measured against a real PIT, and nobody has listened to Fizz 2 on a real Sound Blaster.

## Try it

Everything in this post is in public repositories:

- [liminal-hq/desk](https://github.com/liminal-hq/desk): `dos/` holds the target, linker script, runtime, packer and harness, and `docs/D0-RUST-DOS.md` is the full spike report, failures included. `tools/setup.sh`, then `tools/check.sh`.
- [liminal-hq-labs/liminal-installer](https://github.com/liminal-hq-labs/liminal-installer): `dos/tools/fetch-tools.sh`, `dos/build.sh`, then `dos/tools/e2e.sh` to install Lieutenant Fizz under headless DOSBox and compare the screens with the goldens. `docs/retro-dos.md` describes the runtime.
- [ScottMorris/lieutenant-fizz-2](https://github.com/ScottMorris/lieutenant-fizz-2): the game, with the Web and DOS presenters over one core.

You need `rustup` with `rust-src` (the toolchain file asks for it), Python 3, and `curl`, `tar` and `xz` for the fetch scripts. You do not need a C compiler.

## Credits

This rests on other people's work from three decades ago and today. **DJGPP**, by DJ Delorie and its contributors, defined the go32 format and wrote the stub every program here still starts with. **CWSDPMI**, by Charles W. Sandmann, is the DPMI host inside `SETUP.EXE` and beside Desk's programs. **DOSBox Staging** made headless, scriptable DOS testing possible, `AUTOTYPE` and strict `cputype = 486` included. The later parts of this series lean on **Open Watcom** for the 16-bit work.

## Next

Part 2 drops to 16 bits for [Windows 3.1](/blog/rust-on-windows-3-1), where there is no flat address space to hide in, and part 3 comes back up to [Windows 95, 98 and Me](/blog/rust-on-windows-9x).

All three toolchains are converging on one application. Quill is a small rich-text word processor for DOS, Windows 3.1 and Windows 9x, written in Rust from a shared core. It is still in planning, and a capstone post will cover it once there is something to show.
