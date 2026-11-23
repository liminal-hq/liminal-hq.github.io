---
title: "Cross-compiling to the past, part 1: Rust on DOS"
date: "2026-11-24"
slug: "rust-on-dos"
excerpt: "A custom i486 target got Rust as far as machine code. A DOS loader and a low-memory buffer took it the rest of the way, from printing a string to running an installer."
tags:
  - "Cross-compilation"
  - "Rust"
  - "DOS"
  - "Desk"
  - "Liminal Installer"
draft: true
---

The first time I asked DOS to print a string from Rust, it printed 460 zero bytes. The compiler had produced working 486 instructions and DOS had loaded the program. They disagreed about where the string lived. Getting that detail right gave [Desk](https://github.com/liminal-hq/desk), a graphical shell for old PCs, a file interface that a game installer could reuse.

## Getting from Cargo to a DOS executable

I built Desk on Linux. A custom target file tells Rust to generate 32-bit i486 instructions, and Cargo’s `-Zbuild-std` builds `core` and `alloc` for that processor. Those libraries supply types such as `String` and `Vec`. Desk supplies the allocator that gives them memory. The linker shipped with Rust, `rust-lld`, combines the pieces into an ELF executable. DOS needs a different file format and a way to enter 32-bit protected mode.

I disassembled DJGPP’s DOS loader to see what it read. A 139-line Python packer, `elf2go32.py`, takes the linked code and data, writes the section sizes, offsets and entry point into a 168-byte header, and puts the loader at the front. DOS starts that loader as a 16-bit program. With help from CWSDPMI, a DOS protected-mode host, the loader places the program in extended memory and jumps to its entry point. A little assembly sets up a stack before the first Rust function runs.

## Why the first string went missing

Rust addressed the string in protected memory. The DOS print service expected a real-mode address, expressed as a segment and an offset. CWSDPMI forwarded the registers unchanged, so DOS read from somewhere else.

Desk’s runtime now reserves a 32 KiB buffer below 1 MiB, where both sides can reach it. To write a file, the runtime copies a chunk into that buffer and calls DOS with its real-mode address. For a read, it copies the bytes back. Desk’s test wrote 300,000 bytes and read them back intact, exercising the handoff across several chunks.

![Desk’s DOS test transcript showing matching 300,000-byte writes and reads](/blog/rust-on-dos/desk-hello-transcript.png)

## What a second program can reuse

The [Liminal Installer](https://github.com/liminal-hq-labs/liminal-installer) adopted Desk’s target, packer and file routines. Its portable Rust engine decides which files to install. The DOS code reads keys from the BIOS, draws the screens in text-mode video memory and writes the files through that same buffer. Its loader embeds CWSDPMI, so the user can start `SETUP.EXE` without installing a separate host.

![The Lieutenant Fizz installer welcoming the user in DOS text mode](/blog/rust-on-dos/setup-welcome.png)

The installer runs through setup and uninstall under DOSBox Staging with its CPU set to a 486. Lieutenant Fizz 2 gives a different check on portability. After the same scripted replay, its DOS, native and WebAssembly builds produced the same game-state hash. That gives a new DOS project two working starting points: a runtime for reaching the machine and a way to test whether its Rust logic still agrees with the desktop build. A physical 486 and a 386 remain untested.

Next in the series are [Rust on Windows 3.1](/blog/rust-on-windows-3-1) and [Rust on Windows 9x](/blog/rust-on-windows-9x).
