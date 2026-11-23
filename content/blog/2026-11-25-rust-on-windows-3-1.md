---
title: "Cross-compiling to the past, part 2: Rust on Windows 3.1"
date: "2026-11-25"
slug: "rust-on-windows-3-1"
excerpt: "A Rust installer could call Windows 3.1 and still crash between calls. A stack-pointer probe showed why, and a five-segment program put the fix to the test."
tags:
  - "Cross-compilation"
  - "Rust"
  - "Windows 3.1"
  - "Win16"
  - "Liminal Installer"
draft: true
---

A Rust install engine on Windows for Workgroups 3.11 could copy Lieutenant Fizz’s files byte for byte, then crash on the next run of the same test. Four out of ten install or uninstall runs failed in DOSBox-X. Getting a native Windows dialog on screen had proved that Rust could call 16-bit Windows. The moving crash exposed what it took to keep Rust running between calls.

![The installer’s licence page with native Windows 3.11 controls](/blog/rust-on-windows-3-1/uidemo-licence.png)

## How a Rust function calls 16-bit Windows

I wanted the same Rust install engine that [ran on DOS](/blog/rust-on-dos) to work on Windows 3.1. LLVM’s `code16` mode offered a way in. It emits instructions for a 16-bit code segment but can prefix an instruction to use the 386’s 32-bit registers and addresses. That lets Rust use a 32-bit stack pointer, `ESP`, even in a Windows 3.1 application. Those instructions require at least a 386. The tests used Enhanced mode, and Standard mode remains untested.

Windows expects a New Executable (NE) file, with code and data in segments of up to 64 KiB each. A Python packer converts the output of `rust-lld` to NE and marks the places where the Windows loader must fill in an address. Small assembly routines translate Rust arguments into the words and pointers each Windows function expects. The first version of the message-box executable was 620 bytes. A later test installer showed a native wizard, copied a file and wrote a receipt.

## The stack pointer changed while Rust was running

The install engine often faulted while copying data from its stack. I wrote a probe that stayed in an assembly loop, made no Windows calls and watched `ESP`. In 6.3 seconds the upper half changed to `8001` 130 times. The low half still pointed to the right place. Rust used all 32 bits, turning an ordinary stack read into an address about 2 GiB beyond the segment.

In Windows 3.11’s 386 Enhanced mode, returning from an interrupt to a 16-bit stack could restore only the low half of the pointer. Clearing the high half after each Windows call left Rust exposed to the next timer tick. Giving Windows a 32-bit stack caused faults inside its own kernel.

The runtime now gives the same stack memory two selectors, the handles the CPU uses to address a segment. Rust uses the selector marked 32-bit. The assembly routines switch to Windows’ original 16-bit selector for each call and switch back on return. Both sides see the same bytes with the stack addressing each expects.

## A program can also outgrow one code segment

The combined installer needed more than 64 KiB of code, so its engine and interface had been tested as separate executables. The packer can now distribute functions across segments and insert short routines that transfer control between them. The test program, `BIGSEG.EXE`, exercises both changes with 88 KB of code in five segments.

On Windows for Workgroups 3.11 in DOSBox-X, the test returned correct results in 40 of 40 runs with the stack alias enabled. With it disabled, three of 20 runs returned wrong results. That gives the installer and the Quill word processor a tested route past one segment. The combined installer still needs its own end-to-end run, and the stack fix awaits testing on physical hardware.

[Win16 toolchain and examples](https://github.com/liminal-hq-labs/rust-win16) · [Multi-segment packer and stack fix](https://github.com/liminal-hq-labs/rust-win16/pull/3) · [Next in the series: Rust on Windows 9x](/blog/rust-on-windows-9x)
