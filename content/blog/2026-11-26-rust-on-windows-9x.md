---
title: "Cross-compiling to the past, part 3: Rust on Windows 95, 98 and Me"
date: "2026-11-26"
slug: "rust-on-windows-9x"
excerpt: "The same 2,560-byte Rust executable opened a window on Windows 95 OSR2.5 and Me. Its import table, executable header and machine instructions explain how."
tags:
  - "Cross-compilation"
  - "Rust"
  - "Windows 9x"
  - "Windows Me"
  - "Win32"
  - "Liminal Installer"
draft: true
---

The window says “Hello from Rust on Windows ME!” because that’s where I first ran it. The desktop behind it is Windows 95 OSR2.5. The same 2,560-byte executable ran unchanged on both systems, cross-compiled on Linux with Rust’s 32-bit Windows target. Getting there meant choosing exactly what the program would ask of Windows and of the processor underneath it.

![Windows 95 OSR2.5 displaying the Rust program originally built for Windows Me](/blog/rust-on-windows-9x/win95-me-hello.png)

## Ask Windows for functions it can actually run

Rust’s Windows standard library assumes a much newer operating system. The example uses `#![no_std]` and `#![no_main]` and supplies its own entry point. It registers a window, handles messages and exits through `ExitProcess`. Rust’s `raw-dylib` declarations tell the linker which DLL exports each function, so the Linux build needs neither the Windows SDK’s import libraries nor a C runtime.

The choice of function matters even when its name exists. I took `KERNEL32.DLL` from Windows Me and disassembled `CreateFileW`, the wide-character file function. Its entire body leads to a stub that reports `ERROR_CALL_NOT_IMPLEMENTED`. The examples use the older ANSI entry points for text, including `CreateWindowExA`, and import them under the plain names the DLLs export. The finished hello program asks for 16 functions across three DLLs.

## The loader and the processor make separate decisions

The executable header declares the minimum Windows subsystem version the program expects. I linked the same program twice. Windows Me rejected the build marked 6.0 before the window opened. Passing `/SUBSYSTEM:WINDOWS,4.0` to LLVM’s `lld-link` gave the loader a version it accepted. Wine opened the 6.0 build too, so that particular mistake was only visible in the guest.

Loading the file gets the CPU to the first instruction. Rust’s normal 32-bit Windows target assumes SSE2, an instruction set introduced with the Pentium 4. The original Pentium can’t execute those instructions. The examples request Pentium code generation and their finished binaries were checked for newer instructions. The [Liminal Installer](https://github.com/liminal-hq-labs/liminal-installer) goes further. It rebuilds Rust’s `core` library for its own i586 target, checks the executable header and imported functions, and scans the final machine code. Those checks can catch a newer instruction or API introduced by a later change.

## What ran beyond hello world

The file manager built the same way listed directories and opened folders on Windows 95 OSR2.5 in DOSBox-X. Both it and the hello program also ran on Windows Me in VirtualBox. [Quill](https://github.com/liminal-hq-labs/quill) brought its editor, menus and toolbar to the Windows 95 test system with a checked list of 96 permitted imports.

![Quill’s editor on Windows 95, with a ruler and two rows of toolbar controls](/blog/rust-on-windows-9x/win95-quill.png)

For the installer, this means the Rust engine from [DOS](/blog/rust-on-dos) and [Windows 3.1](/blog/rust-on-windows-3-1) can use Win32, the 32-bit Windows API, to draw its controls. Its Windows build has installed and uninstalled under Wine, including the Start menu shortcut and registry entry. Running that installer on Windows 9x is the next test. The application results so far cover Windows 95 OSR2.5 and Me in emulation or virtualisation. Retail Windows 95, Windows 98 and physical machines remain open targets.
