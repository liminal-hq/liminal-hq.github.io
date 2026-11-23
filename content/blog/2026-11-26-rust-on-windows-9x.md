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

Open a folder, select a file and press Enter. Windows looks up the application associated with that kind of file and opens it for you. If you spent time on Windows 95, your fingers probably remember the interaction. I wanted to write my side of it on Linux, in Rust, with tools from the future, and have it feel completely at home on that desktop.

A little file manager makes a good experiment. It needs to read directories, draw a list, respond to the keyboard and ask the shell to open a file. The shell already knows the user’s file associations. The application can hand it a filename through `ShellExecuteA` and leave that choice where it belongs.

Compared with [16-bit Windows](/blog/rust-on-windows-3-1), this sounded promisingly familiar. Rust already has a 32-bit x86 Windows target. Windows 95, 98 and Me run 32-bit Windows executables. So what has to happen between choosing that target and pressing Enter on a file?

## Give the loader a program it agrees to start

Start with the smaller of the two reference programs. It opens a window, paints a greeting and waits for messages. Two builds of it on Windows Me made the first requirement particularly easy to see. With the linker’s default GUI subsystem version of 6.0, Me said the program expected a newer version of Windows. Mark the same program as version 4.0 and the window opened. Wine opened the 6.0 build too, so testing on Me taught us something the quicker test had missed.

![Windows Me reporting that the executable expects a newer version of Windows](/blog/rust-on-windows-9x/subsystem-6.png)
*Windows Me rejecting the build marked 6.0. The program hasn’t reached its first window call yet.*

The executable format here is PE, short for Portable Executable. Inside its header are fields the loader can inspect before giving the CPU a single instruction from the application. One identifies the Windows subsystem, in this case a graphical application. Another says which subsystem version the application requires. That version field is a promise the rest of the file has to keep.

The reference build used `i686-pc-windows-msvc` with LLVM’s `lld-link` on Linux. These are the settings that explain how a Rust function gets control:

```toml
linker = "lld-link"
rustflags = [
    "-C", "target-cpu=pentium",
    "-C", "link-arg=/NODEFAULTLIB",
    "-C", "link-arg=/ENTRY:start",
    "-C", "link-arg=/SUBSYSTEM:WINDOWS,4.0",
]
```

This excerpt leaves out the fixed-address and relocation settings. The four lines of flags answer four different questions. Which CPU instructions may the compiler choose? May the linker pull in its usual libraries? Where does execution begin? Which Windows loader are we asking to run it?

The program uses `#![no_std]` because Rust’s current Windows standard library expects operating-system services from much newer Windows releases. With `#![no_main]` and our own `start`, we also take responsibility for what happens on entry and exit. The hello program obtains its module handle, registers a window class and creates a window. Then it runs the familiar Win32 message loop. Windows supplies a message, the loop dispatches it, and the window procedure gets a chance to paint or respond to input. When the loop ends, the program calls `ExitProcess`. That’s enough machinery to be a well-behaved graphical application.

## When Enter reaches the shell, which name does it call?

Every imported function is a request the executable makes of an installed DLL. Rust’s `raw-dylib` declarations let us describe those requests in the source, so the build can link on Linux without the Windows SDK’s import libraries. Here’s one function from the message loop:

```rust
#[link(name = "user32", kind = "raw-dylib", import_name_type = "undecorated")]
extern "system" {
    fn GetMessageA(msg: *mut Msg, hwnd: Handle, min: u32, max: u32) -> i32;
}
```

The calling convention tells the compiler how to pass arguments. The import name tells Windows what to look up. On 32-bit x86 the compiler’s internal spelling of a function name can include the argument size. For instance, an object file can use `_ExitProcess@4` for a function Windows exports as `ExitProcess`. Asking for undecorated names makes the import table use the spelling the DLL actually contains. The linker can otherwise produce a perfectly tidy executable that asks the loader for the wrong name.

The final letter in `GetMessageA` matters too. Win32 has pairs of functions ending in `A` and `W`. The former use the system’s ANSI code page for text and the latter use wide characters. Windows 9x exposes some wide-character functions, but finding a name in the DLL doesn’t tell you how much of it works.

I copied `KERNEL32.DLL` off the Windows Me test machine and looked at `CreateFileW`. Its entry point exists. Follow the few instructions there and you arrive at a shared routine that sets error 120, `ERROR_CALL_NOT_IMPLEMENTED`. Other wide-character entries have real implementations. That is a good reason to examine the API a program actually uses before making a compatibility claim.

The file manager keeps directory names in the system code page and passes them along to the ANSI shell call. Now we can finish tracing Enter. The program knows which item is selected. It gives the shell that file’s name. Windows takes care of the association and launches the appropriate application. In the finished binary that ability costs an import from the shell DLL. The file manager has 24 imports altogether. Its programmer can account for what each one asks of the desktop.

## Even a valid Windows executable can ask too much of a Pentium

There’s a second machine reading this file after the loader finishes. A Pentium can execute 32-bit x86 code, but it predates SSE2, an instruction set that the normal Rust target can assume. Choosing a CPU for the application changes the machine code Rust generates for it. Libraries that were compiled earlier keep the instructions they already contain.

The two small example binaries were inspected after linking for SSE instructions and conditional moves introduced after the original Pentium. The installer has more Rust code and more opportunities to pull in part of a prebuilt library. Its custom i586 target rebuilds `core` for the intended CPU. A check on the final executable looks for instructions outside that CPU’s capabilities. Two further checks inspect the PE header and the imported names. Together those checks can catch a compatibility regression while building on a modern machine, before someone has to find a Pentium to explain why setup stopped working. [Installer build settings and compatibility checks](https://github.com/liminal-hq-labs/liminal-installer/tree/main/win32)

## The title bar gives away where this program came from

![A Windows 95 desktop displaying a window that reads “Hello from Rust on Windows ME!”](/blog/rust-on-windows-9x/win95-me-hello.png)
*The title says Me. The desktop is Windows 95 OSR2.5 in DOSBox-X. It’s the same 2,560-byte executable.*

I like this screenshot because the title tells a little of the program’s history. It was built for the Windows Me experiment. It also opened unchanged on Windows 95 OSR2.5. The file manager ran on both, too. On the Windows 95 test system it listed the contents of the drive and opened folders. Those runs cover Windows Me in VirtualBox and Windows 95 OSR2.5 in DOSBox-X. Retail Windows 95, Windows 98 and physical machines remain to be tested.

Quill gives that result a more practical scale. Its Windows 95 build has a menu bar, two rows of toolbar controls, a ruler and a page to write on. The editor runs inside a build limited to 96 permitted imports. The installer takes its own route through the same APIs, using Windows controls for its pages and the shell and registry for Start menu shortcuts and uninstall information. Its end-to-end install and uninstall have run under Wine. The file manager and Quill are the examples we can actually point to on the Windows 95 desktop.

![Quill on Windows 95 showing its document ruler, font controls, menus and blank page](/blog/rust-on-windows-9x/win95-quill.png)
*Quill on Windows 95 OSR2.5. [Quill source](https://github.com/liminal-hq-labs/quill)*

This started with wanting to type `FIZZ.EXE` and play a game on DOS. Here I wanted to press Enter and have Windows open a file the way it always had. In between are three different ways to build an executable and three different agreements about what the machine provides. The part I’d take into another project is the choice that leaves you with. Write the rules of a game, the contents of a document or the steps of an installer in Rust. Then pick one small thing the old machine already knows how to do, and see whether you can ask it in its own language.
