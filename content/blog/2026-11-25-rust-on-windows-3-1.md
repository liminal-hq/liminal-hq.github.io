---
title: "Cross-compiling to the past, part 2: Rust on Windows 3.1"
date: "2026-11-25"
slug: "rust-on-windows-3-1"
excerpt: "A Rust program built on Linux can open a native Windows 3.1 dialog. Here’s how the compiler, executable packer and runtime let a 386 run it."
tags:
  - "Cross-compilation"
  - "Rust"
  - "Windows 3.1"
  - "Win16"
  - "Liminal Installer"
draft: true
---

The licence dialog below belongs to a Rust program built on Linux. Windows 3.1 draws the scroll bar and buttons, handles the mouse and tells the program when someone clicks **Next**. That division of work is why I wanted Rust on this platform. The [DOS installer](/blog/rust-on-dos) already knew how to unpack files and record what it had installed. If the same engine could call the 16-bit Windows interface, I could give it a native setup wizard.

![The Liminal Installer’s licence page on Windows for Workgroups 3.11, with a scrolling licence and Back, Next and Cancel buttons](/blog/rust-on-windows-3-1/uidemo-licence.png)

## What goes on the build machine, and what goes on the old PC?

On Linux, the build uses Rust 1.98 with the Rust library sources, the linker that ships with Rust, and Python 3.9 or later. The application uses `#![no_std]` because Rust’s standard library has no Windows 3.1 implementation. Cargo builds `core`, the part of Rust that works independently of an operating system, for a custom target. A small runtime supplies the startup code and the calls into Windows.

On the old PC, the user opens an ordinary Windows executable. The Rust runtime code it needs is built into that file. The CPU must be a 386 or later because the compiled code uses 32-bit registers. We tested on Windows for Workgroups 3.11 in 386 Enhanced mode under DOSBox-X. Standard mode and physical hardware remain untested.

## How does a Rust call become a Windows dialog?

Take the smallest example, a Rust function that calls `MessageBox`. LLVM, the code generator behind Rust, has a `code16` mode. It emits instructions the processor can read in a 16-bit code segment, with a prefix wherever Rust needs a 32-bit operation. That solves the CPU side. Windows still needs to know where the program starts and which functions it calls.

After `rust-lld` links the program, a Python packer arranges its code and data into the segments Windows expects in a New Executable (NE) file. It records that the program needs function number 1 from Windows’ USER module. When Windows loads the executable, it fills in the address of that function, `MessageBox`. At each call, a short assembly routine puts the arguments on the stack in the order and widths Windows expects. From there Windows draws the box.

## What changes when the program grows?

A message box barely exercises the stack, the memory Rust uses for local variables and return addresses. The installer spends long enough copying files for a timer interrupt to arrive mid-copy. On Windows 3.11, returning to a 16-bit stack could leave the upper half of the 32-bit stack pointer changed. Windows could still use the low 16 bits, but Rust used the whole value and could read far beyond the stack.

The runtime in [the multi-segment toolchain branch](https://github.com/liminal-hq-labs/rust-win16/pull/3) gives the processor two ways to address the same stack memory. Rust uses a segment marked 32-bit so the full pointer survives an interrupt. Each call into Windows switches to the original 16-bit segment and switches back on return.

Program size imposed a second limit. Windows allows 64 KiB per code segment, and the combined installer was larger. The packer on that branch distributes functions across segments and inserts the extra instructions needed to call between them. An 88 KB Rust test program exercised both changes across five segments on Windows 3.11. It returned correct results in 40 of 40 runs. Switching off the stack fix produced wrong results in three of 20 runs.

That gives another Rust project a practical starting point. A small utility can already open windows, handle input and copy files using the public toolchain. For a larger program sharing Rust logic with its DOS counterpart, the experimental packer offers a way past the first 64 KiB. For the Liminal Installer, the engine and wizard have each run on Windows 3.11. Running them together in a single executable is the next test.

[Win16 toolchain and examples](https://github.com/liminal-hq-labs/rust-win16) · [Next in the series: Rust on Windows 9x](/blog/rust-on-windows-9x)
