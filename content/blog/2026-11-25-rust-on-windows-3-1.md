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

After getting Lieutenant Fizz running on DOS, I wanted an installer. There was little about unpacking a file or recording where it went that was peculiar to a game. Someone installing a word processor would need much the same thing. What I wanted to change for Windows 3.1 was the part the person at the keyboard would see. Could I write the installer in Rust and have it look and behave like it belonged on that desktop?

For a first answer, one button was plenty.

![Program Manager on Windows for Workgroups 3.11 with a dialog titled Liminal that reads “Hello from Rust, in 16-bit Windows”](/blog/rust-on-windows-3-1/wfw311-hello.png)
*Windows for Workgroups 3.11 in DOSBox-X. Behind the message box are Eudora Light, Minesweeper and the rest of Program Manager.*

Seeing that screenshot was the moment it felt real to me. Windows had drawn the box, given it a title bar and supplied the OK button. My Rust program had asked for it using the interface that applications on that desktop used. The compiler had even made use of 32-bit registers along the way. How do those belong in a 16-bit Windows program?

## What “16-bit” means to the processor

Picture the build machine and the PC that opens the result. On Linux, the public toolchain uses Rust 1.98 with its library sources, the linker that ships with Rust, and Python 3.9 or later. Cargo builds Rust’s `core` library for a custom target. The application uses `#![no_std]` and supplies an entry point and a small runtime of its own. The old PC gets a Windows executable with that runtime inside. There’s no compiler to install there.

These are the three fields in the target file that explain the trick:

```json
{
  "llvm-target": "i386-unknown-none-code16",
  "cpu": "i386",
  "target-pointer-width": 32
}
```

LLVM, the code generator behind Rust, has a `code16` mode that can produce instructions for a 16-bit code segment. On a 386, an instruction in such a segment can carry a prefix that changes its operand size or address size. The CPU can add two 32-bit values or use a 32-bit register to find something on the stack, then go back to the segment’s usual defaults for the next instruction. That buys Rust room to use its 32-bit pointers and registers. It also puts the resulting program beyond the reach of a 286. The Windows 3.11 tests here used 386 Enhanced mode.

There are still two other parties to satisfy. The Windows loader needs a file describing the segments it should create. Then, when our function calls Windows, both sides have to agree about what’s on the stack.

## Follow one call to MessageBox

Here’s the line at the heart of the toolchain’s smallest example. It asks for a box with a message, a title and an OK button.

```rust
unsafe { MessageBox(0, cs!("Hello from Rust"), cs!("Win16"), MB_OK) };
```

The text and title in this minimal example differ from the greeting in the screenshot. The machinery is the same. On Win16, the function lives in Windows’ USER module, where it can be imported by number. Its number is 1. The address it will occupy is up to Windows when the program loads.

A build script generates a little assembly routine from a table of imports. The `MessageBox` entry tells it which arguments are words and which are pointers. Rust passes values according to the compiler’s conventions. The routine puts them in the order and widths expected by the Windows Pascal calling convention. For a string, Windows needs a *far pointer* consisting of a segment selector and an offset into that segment. The routine makes a far call into USER and, on return, restores registers that the Rust caller expects to keep. That’s what a shim amounts to here. You can point to the arguments it translates and to the instruction where responsibility passes to Windows.

Where does the far call get its destination? After `rust-lld` links the code, the Python packer converts the ELF output to Windows’ New Executable (NE) format. It describes the code and data segments, names the imported module and leaves a *fixup* telling the loader which bytes to patch with the address of USER function 1. Windows assigns the selectors and fills in the call site. Only then can the running program follow that address into the code that draws the box.

![Layout of the original 620-byte message-box executable showing the code, data and four loader fixups](/blog/rust-on-windows-3-1/msgbox-ne-layout.svg)
*The first version of the minimal example fit in 620 bytes. The fixups identify places Windows must complete once it knows where everything lives.*

## Why a wizard asks more of the runtime

A message box spends most of its time waiting for a person. An installer can spend milliseconds in Rust decoding a project or copying a file between calls into Windows. That exposed a peculiarity of the stack, the memory used for local variables, saved registers and return addresses.

The compiler uses the full 32-bit stack pointer, ESP. Its low 16 bits, SP, are enough for ordinary Windows code using the task’s 16-bit stack. Under Windows 3.11 in Enhanced mode, the upper half could change across a timer interrupt. SP could still point to the right byte as far as Windows was concerned. The next Rust instruction to use ESP could ask for a byte about two gigabytes beyond the segment.

A small probe made the difference visible. It stayed in a loop watching ESP and made no Windows calls. In 6.3 seconds it saw the upper half change to `8001` 130 times. Cleaning the register on the way back from each Windows function would leave the whole interval between calls exposed. Marking the entire stack as 32-bit fixed the probe but caused faults in Windows’ own kernel during uninstall. Each side had a legitimate expectation about the stack it was running on.

The experimental runtime gives the CPU two selectors for the same stack memory. One describes a 32-bit stack for Rust. The other is Windows’ original 16-bit selector. The assembly routines switch to the Windows selector immediately before calling Windows and switch back when Rust resumes. The bytes can stay put while the processor changes how it addresses them. [Stack handling and multi-segment toolchain work](https://github.com/liminal-hq-labs/rust-win16/pull/3)

## How much installer fits behind a Next button?

Here’s the screenshot that made me want to take the experiment further.

![The installer’s licence page with a scrolling licence, radio buttons and Back, Next and Cancel controls](/blog/rust-on-windows-3-1/uidemo-licence.png)
*The Win16 interface running on Windows for Workgroups 3.11. The installer describes the page, and Windows provides its controls.*

To Windows, accepting the licence is an interaction with a control. To the installer, it changes whether the user can proceed. The installer already has portable code for deciding which page follows, interpreting the project and writing its files. Somebody building an entirely different application could use the same Windows interface and supply their own meaning for that click.

There’s a size cost to bringing a useful engine along. A Win16 code segment holds at most 64 KiB. The compiler normally emits a near call between Rust functions, meaning the destination is inside the current segment. The combined engine and interface outgrew that space. We could run them separately, which is why a screenshot of the licence page and a successful install-engine run answer different questions.

The experimental packer can place functions in several code segments and insert short routines to reach a function in another segment. Its test program had 88 KB of code across five segments and checked its results against a second implementation. In DOSBox-X running Windows for Workgroups 3.11, it returned correct results in all 40 runs with the stack fix enabled. With the fix disabled, it produced wrong results in three of 20. That exercise gives larger projects a concrete way forward. A full run of the combined installer, Standard mode and physical hardware are separate tests still to make.

For someone with a smaller idea, the distance to the desktop is shorter. The public examples already include a message box, a window that paints and responds to messages, and a small installer that copies a bundled file and writes a receipt. A Rust utility can have an ordinary place in Program Manager. The next question, on [Windows 95, 98 and Me](/blog/rust-on-windows-9x), is what it takes to earn the same place on a desktop that already speaks 32-bit Win32. [Win16 toolchain and examples](https://github.com/liminal-hq-labs/rust-win16)
