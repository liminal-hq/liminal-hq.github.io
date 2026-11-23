---
title: "Cross-compiling to the past, part 3: Rust on Windows 95, 98 and Me"
date: "2026-11-26"
slug: "rust-on-windows-9x"
excerpt: "Windows 95 runs 32-bit Windows programs, and Rust builds them, yet a plain Rust hello world won't start there. Windows 9x speaks its own dialect of Win32, and a 2,560-byte no_std program, a few linker flags and an import allowlist are how Rust learns it."
tags:
  - "Cross-compilation"
  - "Rust"
  - "Windows 9x"
  - "Windows Me"
  - "Win32"
  - "Liminal Installer"
draft: true
---

> **In this series: Cross-compiling to the past.** One portable Rust core, built on a modern Linux PC, carried to three old platforms. Quill, a small word processor built the same way, turns up along the way.
>
> 1. [Rust on DOS](/blog/rust-on-dos): a 32-bit protected-mode runtime, a packer, and a DOS installer.
> 2. [Rust on Windows 3.1](/blog/rust-on-windows-3-1): 16-bit code, a hand-built NE executable, and a crash that arrives with the timer.
> 3. **Rust on Windows 95, 98 and Me** (this post): why "any Win32 program" doesn't include Rust's, and what it takes to change that.

Windows 95 is where most people met 32-bit Windows programs, and Rust builds 32-bit Windows programs. A plain `cargo new` hello world still won't start there. The program in this screenshot does, and the difference between the two is the whole post.

![A Windows 95 desktop with a window titled "Rust on Windows ME" that reads "Hello from Rust on Windows ME!" and "no_std, i686-pc-windows-msvc, linked with lld-link"](/blog/rust-on-windows-9x/win95-me-hello.png)
*`me-hello.exe` on Windows 95 OSR2.5 in DOSBox-X. It was written for Windows Me, hence the title, and it runs on 95 unchanged: 2,560 bytes, built by Rust 1.98 on Linux.*

The programming interface of 32-bit Windows is called **Win32**, and the usual picture is that "Win32 is Win32". That picture breaks in a few specific places. Once you see where, everything Liminal HQ has built for these systems since follows from it, including the installer's Windows 95 runtime and Quill.

## The belief: a 32-bit Windows program runs on any 32-bit Windows

It's a reasonable belief. Windows 95 brought Win32 to home PCs in 1995, Windows NT had it from 1993, and the function names match: `CreateWindowExA`, `GetMessageA`, `CreateFileW`. Most programs of the late 1990s ran on both. Plenty of people, me included, carried that assumption forward to "a 32-bit Windows program built today runs on Windows 95, if nothing in it is too new".

The Liminal Installer needed to know whether that held. Windows 95, 98 and Me (together, **Windows 9x**) are the next systems after DOS and Windows 3.1, and [Part 2](/blog/rust-on-windows-3-1) had already ruled out Win32s for Windows 3.1. Here the installer can use Rust's own Windows target, with the same portable core as the other two runtimes. One caveat up front: this post covers Windows 95 and Me, and Windows 98 hasn't been run at all.

## A Rust hello world breaks it three ways

Ask `cargo` for a normal hello world for `i686-pc-windows-msvc`, Rust's 32-bit Windows target, and it brings three things Windows 9x can't supply. I couldn't link one on this Linux machine, so what follows rests on what the program asks for and on Rust's own policy. I haven't watched one fail.

The first is the standard library, **`std`**, the part of Rust that wraps the operating system. Since Rust 1.78, `std` on the regular Windows targets assumes Windows 10, and the tier-3 `*-win7-windows-msvc` targets reach back only to Windows 7. That's a fair call for a language that ships security fixes, and it puts `std` out of the question here.

The second is the **C runtime**, the library of start-up code and basic functions that a Windows program built with Microsoft's tools links against. On current Visual Studio that means `vcruntime140.dll` and the Universal CRT, and neither has heard of Windows 98.

The third is the **import table**, the list of Windows functions a program asks for when it loads. Running `llvm-nm -u` over the 1.98 `libstd` for this target lists 139 Win32 functions it can import. Thirty-eight end in `W`, such as `CreateFileW`, and some arrived much later: `WaitOnAddress` in Windows 8, and `ProcessPrng` later still.

![A comparison of stock Rust with std against me-hello.exe: C runtime, import libraries, functions referenced, oldest Windows and file size](/blog/rust-on-windows-9x/imports.svg)
*What a std program asks Windows for, next to what `me-hello.exe` asks for. The left column comes from `llvm-nm` on libstd, the right from the finished file's import table.*

On Linux with no Windows SDK installed, the `std` build stops at the linker with `could not open 'kernel32.lib'` and four more like it. That failure turned out to be a useful hint: the fix for all three problems is to stop asking for things.

## Windows 9x speaks a dialect of Win32

Here is the model that replaced the belief. Windows NT was Unicode inside from the start, and its `...W` ("wide") functions are its native interface. Windows 95, 98 and Me kept strings in the ANSI code page, Windows-1252 on an English install, and implemented only a handful of wide functions for real. The rest exist so that programs load, then fail when called.

It works like a regional dialect. The vocabulary looks the same, and a visitor who sticks to common words gets by. The analogy breaks in one useful place: a real dialect speaker would look puzzled at an unknown word, while Windows 9x nods along at load time and only fails when the word is used.

> **What a nod looks like.** I copied `KERNEL32.DLL` off the Windows Me 4.90.3000 machine, by floppy, and disassembled it. It exports 148 names ending in `W`. Here is `CreateFileW`, in full:
>
> ```text
> bff99b5d <CreateFileW>:
> bff99b5d:  xorl  %eax, %eax
> bff99b5f:  movb  $0x7, %cl
> bff99b61:  jmp   0xbff61319
> ```
>
> The jump lands in a shared stub that pushes `0x78` and calls `SetLastError`. `0x78` is 120, `ERROR_CALL_NOT_IMPLEMENTED`. `FindFirstFileExW` is the same three instructions with a different number in `cl`, while `GetCommandLineW` has a real body.

The dialect also has rules about the file itself. Every Windows executable records the Windows version it expects, its subsystem version. Today's linkers stamp 6.0 (Windows Vista), and the 9x loader checks. I built the same program with plain `/SUBSYSTEM:WINDOWS` to see:

![Two Windows Me error dialogs: one says the program expects a newer version of Windows, the other says a device attached to the system is not functioning](/blog/rust-on-windows-9x/subsystem-6.png)
*The same program stamped with subsystem 6.0. Windows Me refuses it twice: once accurately, and once with a message about a device.*

## Writing in the dialect starts with `no_std`

The reference project, `win9x-rust`, has two programs: `me-hello`, the window at the top, and `me-files`, a 737-line file manager. Both drop the standard library and its start-up code with `#![no_std]` and `#![no_main]`, so the entry point is theirs to write (the project uses Rust's 2021 edition, hence the plain `#[no_mangle]`):

```rust
#[no_mangle]
pub extern "C" fn start() -> ! {
    unsafe {
        let instance = GetModuleHandleA(null());
        // RegisterClassA, CreateWindowExA ...
        let mut msg = MaybeUninit::<Msg>::uninit();
        while GetMessageA(msg.as_mut_ptr(), null_mut(), 0, 0) > 0 {
            TranslateMessage(msg.as_ptr());
            DispatchMessageA(msg.as_ptr());
        }
        ExitProcess(msg.assume_init_ref().wparam as u32)
    }
}
```

That's the message loop from every Win32 tutorial written in 1996. There's no C runtime underneath to return to, so the function never returns and ends in `ExitProcess`, and a panic ends there too, with exit code 1.

Normally a program learns where `CreateWindowExA` lives from `user32.lib` in the Windows SDK. Rust's `raw-dylib` link kind lets the compiler write the import table itself from the declarations in the source:

```rust
#[link(name = "user32", kind = "raw-dylib", import_name_type = "undecorated")]
extern "system" {
    fn RegisterClassA(class: *const WndClassA) -> u16;
    fn GetMessageA(msg: *mut Msg, hwnd: Handle, min: u32, max: u32) -> i32;
}
```

`import_name_type = "undecorated"` matters only on 32-bit x86. The `stdcall` convention decorates names, so `ExitProcess` becomes `_ExitProcess@4` inside the object files, while Windows exports the plain name. Leave the attribute off and the program still builds without complaint, but its import table asks `kernel32.dll` for `_ExitProcess@4`, a name no Windows has ever exported. I built it both ways to be sure.

The finished `me-hello.exe` imports 16 functions from `kernel32`, `user32` and `gdi32`, and every one takes ANSI strings or none. The file manager imports 24, adding `ShellExecuteA` so Enter opens a file in its associated program. On the 9x side, file names are then bytes in the system code page, handed to the screen without decoding, so the programs keep their own text to ASCII, where UTF-8 and the code page agree.

## Four linker flags satisfy a 1995 loader

The rest is in `.cargo/config.toml`, and `lld-link`, LLVM's stand-in for Microsoft's `link.exe`, runs on Linux:

```toml
[target.i686-pc-windows-msvc]
linker = "lld-link"
rustflags = [
    "-C", "target-cpu=pentium",
    "-C", "link-arg=/NODEFAULTLIB",          # no CRT, so msvcrt stays out
    "-C", "link-arg=/ENTRY:start",           # our start, not mainCRTStartup
    "-C", "link-arg=/SUBSYSTEM:WINDOWS,4.0", # what the 9x loader accepts
    "-C", "link-arg=/FIXED",                 # no relocations
    "-C", "link-arg=/DYNAMICBASE:NO",        # no ASLR flag
]
```

Subsystem 4.0 is the flag the loader enforces. `/FIXED` is about size. **Relocations** are the notes that let Windows load a program at a different address than planned, and an EXE on Windows 9x always loads at its planned address, so the table is dead weight. Without the flag the file grows from 2,560 to 3,072 bytes.

## The CPU floor is a Pentium

`target-cpu=pentium` is about the processor. Rust's 32-bit Windows target assumes **SSE2**, a set of instructions for working on several numbers at once that arrived with the Pentium 4 in 2000. Plenty of machines that ran Windows 95 and 98 had no SSE of any kind.

Rust 1.98 warns that turning SSE2 off on this target "is being phased out" and will become a hard error, because it changes how floating-point values are passed between functions. Neither program uses a float, and `llvm-objdump` finds no SSE register and no `cmov` (a Pentium Pro instruction) in either binary.

> **The memcpy nobody wrote.** The file manager first failed to link with `undefined symbol: _memcpy`. The compiler emits calls to `memcpy` for large copies and expects the C runtime to supply it. With the runtime gone, `me-files` defines its own, as a `rep movsb` in inline assembly. A plain byte loop would be the natural body, but LLVM recognises copy loops and replaces them with a call to `memcpy`, which here would be the function calling itself forever.

## The model holds on Windows 95 OSR2.5 in an emulator

The installer repository now has a Windows 95 test bed. It runs Windows 95 OSR2.5 in DOSBox-X 2025.02.01, headless, from a read-only disk image with a throwaway copy per run, and drives the guest with typed keys and slow, one-pixel mouse steps.

OSR2.5 isn't the 1995 retail floor, and the test bed records exactly what it is. Its `KERNEL32.DLL` and `SHELL32.DLL` are 4.00.1111, newer than retail's 4.00.950, and its common controls (`COMCTL32.DLL`) are 4.70. A second image adds Internet Explorer 4.01 from the same disc, which brings the common controls up to 4.72.

Both reference programs run on it unchanged, as the screenshot at the top shows, and the file manager lists `C:`, sorts folders first and opens a folder on a double click. Quill's Win32 build runs there too, with its menus, the two-row toolbar and the ruler. It's built the same way, with its imports held to a 96-entry allowlist and no `...W` entry points.

![Quill on Windows 95: a word-processor window with a menu bar, two toolbar rows with style, font and size boxes, a ruler in inches and an empty page](/blog/rust-on-windows-9x/win95-quill.png)
*`QUILL32.EXE` on Windows 95 OSR2.5 at 640 by 480 in 16 colours, the test bed's standard VGA mode.*

## The installer turns the dialect into a build rule

The installer's Win32 runtime is where the model stops being an observation and becomes a check that fails the build. Its `SETUP.EXE` runs the same flow VM and install engine as the DOS runtime from [Part 1](/blog/rust-on-dos), drawn with real Windows controls: check boxes, a `msctls_progress32` progress bar, and the shell's folder browser.

Three checks run in CI. `check-imports.sh` fails on any import that isn't on a 94-entry allowlist, and on any name ending in `W`. The allowlist is meant to hold only functions Windows 95 exports; it was checked by hand against the Win32 reference, and nobody has yet read it off a Windows 95 disk.

`check-pe.sh` requires a GUI program in the PE format (Windows' executable format) with subsystem 4.0 and no relocations. `scan-pentium.sh` fails on any MMX, SSE or `cmov` instruction.

The CPU rule goes further than in `win9x-rust`. The `core` library that Rust ships prebuilt for `i686-pc-windows-msvc` was compiled assuming SSE2, and it holds 812 SSE register references and 618 `cmov` lines. A program linked against it would fault on a Pentium, a Pentium MMX or an AMD K6, the machines Windows 95 ran on. So the installer builds `core` from source for its own `i586` target, with MMX, SSE and the x87 maths unit switched off.

`SETUP.EXE` is 135,680 bytes, or 115,200 with the hand-written decoder from Part 2. Under Wine, it installs and uninstalls Lieutenant Fizz and Planboard, and the test checks every page against its golden, then the files, the Start menu shortcut and the Add/Remove Programs entry, and checks that the uninstall removes them all. It hasn't run on Windows 95, 98 or Me yet. The test bed exists now, so that's the next run.

> **A crash that wasn't Rust's.** The Windows Me VM behind this series' Me screenshots froze more than once in VirtualBox 7.2.22. One log shows a triple fault (a fault while handling a fault while handling a fault, after which a real PC resets) 0.3 seconds after the virtual sound card opened, in Windows' own ring-0 system code, with the stack itself as the faulting address.
>
> The host is a Ryzen 7 7700X, a Zen 4 processor, and the [patcher9x](https://github.com/JHRobotics/patcher9x) project documents a TLB invalidation bug in Windows 98, 98 SE and Me on AMD Zen 2 and Intel 11th-generation CPUs and newer, which puts this host squarely in range. It notes that Me reaches the affected code rarely, during driver installs and updates. VirtualBox also gave the guest a time-stamp counter of 4,294,967,295 ticks a second, the most 32 bits can hold, on a 4.5 GHz host.
>
> I haven't applied patcher9x. Since then the guest counter is pinned at 1 GHz, the USB 2.0 controller and USB tablet are gone in favour of a PS/2 mouse, and the audio is off. The next session ran for 12 minutes and shut down normally. That's one clean run after four changes, so the cause isn't proven, and I can't say which change mattered.

## Limits and what hasn't been tested

- `me-hello` and `me-files` run on Windows Me 4.90.3000 in VirtualBox, on Windows 95 OSR2.5 in DOSBox-X, and under Wine 11.21.
- Quill's Win32 build runs on Windows 95 OSR2.5 in the test bed, and its earlier milestones ran on the Windows Me VM.
- The installer's Win32 `SETUP.EXE` has run only under Wine.
- Not tested: retail Windows 95 (4.00.950), Windows 98, and any real hardware.
- Wine is a sanity check only. The subsystem 6.0 build that Windows Me refused twice opens under Wine without a word.

Across the series, each runtime has its own CPU floor: a 486 by test for DOS, a 386 in Enhanced mode for Windows 3.1, and a Pentium for Windows 95.

## Try it

`win9x-rust`, the reference project with `me-hello` and `me-files`, isn't public yet. Everything else is.

The installer's Win32 runtime is in `win32/` of [liminal-hq-labs/liminal-installer](https://github.com/liminal-hq-labs/liminal-installer), described in `docs/retro-win32.md`, and the Windows 95 test bed is in PR #35 with `docs/win95-testbed.md`. Quill is at [liminal-hq-labs/quill](https://github.com/liminal-hq-labs/quill). You need `rustup` with `rust-src` and LLVM's `lld-link`; Wine is the quickest way to try the results.

## Credits

**LLVM**'s `lld-link` made a Windows linker that runs on Linux with no SDK, and Rust's `raw-dylib` made the import libraries unnecessary. **Wine** was the fast check before every VM run. **DOSBox-X** runs Windows 95 well enough to drive headless, and **VirtualBox** has carried the Windows Me VM through the whole series, freezes included. The **patcher9x** project's notes are the clearest account I found of why old Windows struggles on new CPUs.

## Next

So Windows 95 doesn't run every Win32 program. It runs programs written in its dialect: ANSI functions only, subsystem 4.0, and nothing from a C runtime it never shipped, built for a CPU it knew. Rust can write that dialect from a Linux machine with no Windows SDK, as long as checks in the build hold it to the rules.

That's the last of the three platforms. The installer has a DOS runtime that installs under DOSBox, a Windows 95 runtime that so far installs only under Wine, and a Windows 3.1 runtime that is being relinked into one program with Part 2's multi-segment packer. Quill runs on DOS and Windows 95 from one Rust core, and on Windows 3.1 it has so far reached test programs.
