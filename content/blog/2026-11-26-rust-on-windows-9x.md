---
title: "Cross-compiling to the past, part 3: Rust on Windows 95, 98 and Me"
date: "2026-11-26"
slug: "rust-on-windows-9x"
excerpt: "Windows 95 runs 32-bit Windows programs, and Rust builds them, yet a plain Rust hello world won't start there. Windows 9x speaks its own dialect of Win32, and a 2,560-byte no_std program, five linker flags and an import allowlist are how Rust learns it."
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
> 1. [Rust on DOS](/blog/rust-on-dos): a floppy-disk question, a 32-bit protected-mode runtime, and a Rust pipeline from Linux to DOS.
> 2. [Rust on Windows 3.1](/blog/rust-on-windows-3-1): 16-bit code, a hand-built NE executable, and a crash that arrives with the timer.
> 3. **Rust on Windows 95, 98 and Me** (this post): why "any Win32 program" doesn't include Rust's, and what it takes to change that.

Open a folder, highlight a file and press Enter. Windows looks up the file's type and launches the right program. If you spent time on Windows 95, your fingers still remember that rhythm.

I wanted to write my side of that interaction on a 2026 Linux PC, in Rust, using tools from the future, and drop the result onto a Windows 95 desktop where it felt at home. It should call the same functions programs called back then and fit in with the desktop the way people expect. A small file manager, `me-files`, made a good test: 737 lines that list a folder, draw a window, handle keys, and hand the selected file name to `ShellExecuteA` when you press Enter.

Compared with DOS extenders and 16-bit segments, that sounded straightforward. Windows 95, 98 and Me (together, **Windows 9x**) run 32-bit programs written for **Win32**, the 32-bit Windows programming interface, and Rust ships an official 32-bit Windows target, `i686-pc-windows-msvc`. Most of us carry a quiet assumption that "Win32 is Win32": a 32-bit Windows program built today will start on Windows 95 as long as it avoids newer functions.

A plain `cargo new` hello world breaks that belief in three ways, and even a program that avoids all three gets turned away if one number in its header looks too modern:

![Two Windows Me error dialogs: one says the program expects a newer version of Windows, the other says a device attached to the system is not functioning](/blog/rust-on-windows-9x/subsystem-6.png)
*The same small program stamped with subsystem version 6.0. Windows Me refuses it twice, once accurately and once with a message about a device.*

## Why a stock Rust hello world won't start on Windows 9x

Ask Cargo for a regular program for `i686-pc-windows-msvc` and it brings in three things Windows 95, 98 and Me can't supply. I couldn't link one on Linux without Windows' own libraries, so this rests on what the program asks for and on Rust's own policy, not on watching it fail.

The first is the standard library, `std`, the part of Rust that wraps the operating system. Since Rust 1.78 it assumes Windows 10 on the regular Windows targets, and the tier-3 `*-win7-windows-msvc` targets reach back only to Windows 7.

The second is the C runtime, the start-up code and basic functions that a program built with Microsoft's tools links against. Today that means `vcruntime140.dll` and the Universal CRT, and neither exists on Windows 9x.

The third is the **import table**, the list of Windows functions a program asks for when it loads. Running `llvm-nm -u` over Rust 1.98's `libstd` for this target lists 139 Win32 functions it can import, including 38 wide-character (`...W`) functions, raw `Nt*` calls into `ntdll.dll`, and newer ones such as `WaitOnAddress` (Windows 8) and `ProcessPrng`.

![A comparison of stock Rust with std against me-hello.exe: C runtime, import libraries, functions referenced, oldest Windows and file size](/blog/rust-on-windows-9x/imports.svg)
*What a std program asks Windows for, next to what the small `me-hello.exe` asks for. The left column comes from `llvm-nm` on libstd, the right from the finished file's import table.*

On Linux with no Windows SDK installed, a `std` build stops at the linker with `could not open 'kernel32.lib'` and four more missing import libraries. That error pointed straight at the answer: stop asking for things Windows 95 never had.

## Windows 9x speaks a dialect of Win32

A better mental model is that Windows 9x speaks a regional dialect of Win32.

Windows NT was Unicode inside from its first release in 1993, so its `...W` ("wide") functions are its native interface. Windows 95, 98 and Me kept strings in the system's ANSI code page, Windows-1252 on an English install, and implemented only a handful of `...W` functions for real.

Like a regional dialect, the vocabulary looks familiar enough to get by if you stick to common words. The analogy breaks in one dangerous spot. A person who doesn't know a word looks puzzled, while Windows 9x nods politely at load time, exporting the `...W` name so your program starts, and then fails the moment you call it.

> **What a nod looks like inside Windows Me's KERNEL32.DLL.** I copied `KERNEL32.DLL` off the Windows Me 4.90.3000 virtual machine by floppy image and disassembled it. It exports 148 function names ending in `W`. Here is `CreateFileW` in its entirety:
>
> ```text
> bff99b5d <CreateFileW>:
>   bff99b5d: xorl %eax, %eax
>   bff99b5f: movb $0x7, %cl
>   bff99b61: jmp  0xbff61319
> ```
>
> The jump lands in a shared stub that pushes `0x78` (120, `ERROR_CALL_NOT_IMPLEMENTED`) and calls `SetLastError`. `FindFirstFileExW` is the same three-instruction stub, while `GetCommandLineW` has a real body. Checking a DLL's export list isn't enough; a program has to stay in the ANSI `...A` dialect.

## Speaking the dialect from Linux with no Windows SDK

Both reference programs, `me-hello` and `me-files`, drop `std` and the C start-up code with `#![no_std]` and `#![no_main]`, and go straight into the classic Win32 message loop (they use Rust's 2021 edition, hence the plain `#[no_mangle]`):

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

There's no C runtime underneath to return to, so `start` never returns: a normal exit and a panic both end in `ExitProcess`.

Normally a program learns where `CreateWindowExA` lives from `.lib` import libraries in the Windows SDK. Rust's `raw-dylib` feature lets the compiler write the PE import table itself from the declarations in the source:

```rust
#[link(name = "user32", kind = "raw-dylib", import_name_type = "undecorated")]
extern "system" {
    fn RegisterClassA(class: *const WndClassA) -> u16;
    fn GetMessageA(msg: *mut Msg, hwnd: Handle, min: u32, max: u32) -> i32;
}
```

That `import_name_type = "undecorated"` is a 32-bit x86 trap waiting to happen. Under the `stdcall` convention, object files decorate names with the size of the arguments, turning `ExitProcess` into `_ExitProcess@4`, while Windows exports the plain name. Leave the attribute off and the program links without a single warning, then asks `KERNEL32.DLL` for a name no version of Windows has ever exported. I built it both ways to be sure.

Here's where Enter meets the shell. `me-files` keeps folder paths as bytes in the system's ANSI code page and hands the selected name straight to `ShellExecuteA`, which looks up the file's type and starts the right program. The whole file manager needs 24 imports, and `me-hello` needs 16, none of them ending in `W`.

## Five linker flags that satisfy a 1995 loader

On Linux, LLVM's `lld-link` stands in for Microsoft's `link.exe`. Five linker flags in `.cargo/config.toml` shape the **PE** header (PE, Portable Executable, is the Win32 program format) into something a 1995 loader accepts:

```toml
[target.i686-pc-windows-msvc]
linker = "lld-link"
rustflags = [
    "-C", "target-cpu=pentium",
    "-C", "link-arg=/NODEFAULTLIB",          # no CRT, so msvcrt stays out
    "-C", "link-arg=/ENTRY:start",           # our start, not mainCRTStartup
    "-C", "link-arg=/SUBSYSTEM:WINDOWS,4.0", # what the 9x loader accepts
    "-C", "link-arg=/FIXED",                 # no relocation table
    "-C", "link-arg=/DYNAMICBASE:NO",        # no ASLR flag
]
```

Today's linkers stamp subsystem version 6.0 (Windows Vista) by default. Wine opened the 6.0 test build without a word, and Windows Me refused it twice, which is why Wine counts here as a quick sanity check and never as proof. Stamping 4.0 satisfies the loader. `/FIXED` drops the relocation table, the notes that let Windows load a program somewhere other than planned, which a Windows 9x program never uses, and takes `me-hello.exe` from 3,072 bytes down to 2,560.

> **The memcpy nobody wrote.** When `me-files` grew, linking failed with `undefined symbol: _memcpy`. LLVM emits calls to `memcpy` for large copies and expects the C runtime to supply it. Writing your own as a plain byte loop backfires, because LLVM's optimizer recognises copy loops and replaces the body with a call to `memcpy`, which would then call itself forever. The fix is a few lines of inline assembly around `rep movsb`.

## What Windows 95 does when you start the program

Every Win32 program still begins the way a DOS program does, with the letters `MZ` and a tiny DOS program. Run `me-hello.exe` from a DOS prompt and that stub prints `This program cannot be run in DOS mode.` Windows skips the stub and reads the PE header that follows it.

From there the loader works through a short list. It checks the subsystem version, which is where a 6.0 program gets refused. It maps each section into memory at the program's preferred address, `0x00400000`, which is always free for an EXE on Windows 9x, so the missing relocation table never matters.

It looks up every import by name in `KERNEL32.DLL`, `USER32.DLL` and `GDI32.DLL`, and any name it can't find stops the program before it starts. Then it jumps to `start`, and the message loop takes over.

Windows 95, 98 and Me also still carry the 16-bit Windows subsystem from Part 2. The 16-bit installer proof from that post ran to its last page on Windows Me, which reports itself to a 16-bit program as Windows 3.95. On these systems that's a bonus, though: a 32-bit program gets long file names, the registry and the 32-bit common controls without any of the 16-bit workarounds.

> **Where 2,560 bytes go.** `me-hello.exe` is 1,024 bytes of headers (the DOS stub and the PE header), 501 bytes of code padded to 512, and the read-only data padded to 1,024: its strings and the import table. `me-files.exe` is 8,192 bytes, and its whole state lives in one `static mut` of 1,024 directory entries. That's a `.data` section of 280,932 bytes of zeros, which takes no space in the file at all: the section header gives its size, and the loader allocates and clears the memory.

## Even a valid program can ask too much of a Pentium

Getting past the Windows 95 loader is only half of it. The CPU still has to run the instructions inside.

Rust's `i686-pc-windows-msvc` target assumes **SSE2**, instructions that work on several numbers at once and arrived with the Pentium 4 in 2000. `-C target-cpu=pentium` changes the code generated for your own crate, and Rust 1.98 warns that turning SSE2 off on this target "is being phased out" because it changes how floating-point values are passed. It doesn't change the precompiled `core` library that Rust ships.

That prebuilt `core` holds 812 SSE register references and 618 `cmov` instructions (a Pentium Pro addition). Small programs that never touch those paths can slip through, and `llvm-objdump` finds no SSE register or `cmov` in `me-hello.exe` or `me-files.exe`. A real application linked against the prebuilt `core` would fault on an original Pentium, a Pentium MMX or an AMD K6, the machines Windows 95 ran on.

That's where the Liminal Installer turns the dialect from an observation into rules its build enforces:

- `core` is rebuilt from source for a custom `i586` target with MMX, SSE and the x87 maths unit switched off.
- `check-imports.sh` fails the build on any import outside a 94-entry allowlist, and on any name ending in `W`. The allowlist was checked by hand against the Win32 documentation, not read from a Windows 95 disk.
- `check-pe.sh` checks for a GUI program with subsystem 4.0 and no relocations.
- `scan-pentium.sh` disassembles the finished program and fails on any MMX, SSE or `cmov` instruction.

## The title bar gives away where this program came from

Windows 95 needed a place to run. The installer repository's test bed runs Windows 95 OSR2.5 headless in DOSBox-X, booting a throwaway copy of a read-only disk image for each run and driving it with typed keys and slow mouse steps. OSR2.5 isn't the 1995 retail release: its `KERNEL32.DLL` and `SHELL32.DLL` are 4.00.1111, and its common controls (`COMCTL32.DLL`) are 4.70, or 4.72 on a second image with Internet Explorer 4.01 added.

![A Windows 95 desktop with a window titled "Rust on Windows ME" that reads "Hello from Rust on Windows ME!" and "no_std, i686-pc-windows-msvc, linked with lld-link"](/blog/rust-on-windows-9x/win95-me-hello.png)
*`me-hello.exe` on Windows 95 OSR2.5 in DOSBox-X: the same 2,560-byte program, unchanged.*

I love that screenshot because the title bar still says "Rust on Windows ME". It was built for the Windows Me virtual machine, and the same file opened unchanged on Windows 95 OSR2.5. `me-files` ran on both as well, listing `C:\`, sorting folders first, and opening a folder on a double click on the Internet Explorer 4 image.

Quill takes the same pipeline to a full application: a menu bar, two rows of toolbars, a ruler and a page, on Windows 95 OSR2.5 in the test bed's 640 by 480, 16-colour VGA mode, with its imports held to a 96-entry ANSI allowlist.

![Quill on Windows 95: a word-processor window with a menu bar, two toolbar rows with style, font and size boxes, a ruler in inches and an empty page](/blog/rust-on-windows-9x/win95-quill.png)
*`QUILL32.EXE` on Windows 95 OSR2.5 in DOSBox-X.*

The Liminal Installer's Win32 `SETUP.EXE` runs the same engine as the DOS installer from [Part 1](/blog/rust-on-dos), drawn with native Windows controls: check boxes, a `msctls_progress32` progress bar, Start menu shortcuts and an Add/Remove Programs entry. It's 135,680 bytes, or 115,200 with the hand-written decoder from [Part 2](/blog/rust-on-windows-3-1), which isn't merged yet. Under Wine it installs and uninstalls Lieutenant Fizz and Planboard, checked page by page against goldens. Running it in the Windows 95 test bed is next.

> **A Windows Me crash that wasn't Rust's.** The Windows Me virtual machine in VirtualBox 7.2.22 froze more than once. One log shows a triple fault (a fault while handling a fault while handling a fault, after which a real PC resets) in Windows' own ring-0 code, 0.3 seconds after the virtual sound card opened.
>
> The host is a Ryzen 7 7700X, a Zen 4 processor, which falls in the range of the TLB invalidation bug that the [patcher9x](https://github.com/JHRobotics/patcher9x) project documents for Windows 98, 98 SE and Me on AMD Zen 2 and Intel 11th-generation CPUs and newer. VirtualBox was also handing the guest a time-stamp counter of 4,294,967,295 ticks a second, the most 32 bits can hold. patcher9x hasn't been applied. Pinning the guest's counter to 1 GHz, swapping the USB 2.0 controller and USB tablet for a PS/2 mouse, and turning off audio gave a clean 12-minute session and a normal shutdown. That's four changes and one clean run, so the culprit isn't proven.

## Limits and what hasn't been tested

- `me-hello` and `me-files` have run on Windows Me 4.90.3000 in VirtualBox, on Windows 95 OSR2.5 in DOSBox-X, and under Wine 11.21. Quill's Win32 build has run on Windows 95 OSR2.5 and Windows Me.
- The installer's Win32 `SETUP.EXE` has run only under Wine so far.
- Not tested: retail Windows 95 (4.00.950), Windows 98, and any real Pentium-class hardware.
- The CPU floors across the series: a 486 by test for DOS, a 386 in Enhanced mode for Windows 3.1, and an original Pentium for Windows 95.

## Try it

The installer's Win32 runtime and its build checks are in `win32/` of [liminal-hq-labs/liminal-installer](https://github.com/liminal-hq-labs/liminal-installer), and Quill is at [liminal-hq-labs/quill](https://github.com/liminal-hq-labs/quill). `win9x-rust`, with `me-hello` and `me-files`, isn't public yet. You need `rustup` with `rust-src` and LLVM's `lld-link`, with Wine as the quick check before booting DOSBox-X or a virtual machine.

## Credits

LLVM's **`lld-link`** gave Linux a Windows linker that needs no SDK, and Rust's **`raw-dylib`** removed the need for import libraries. **Wine**, **DOSBox-X** and **VirtualBox** carried the testing, and the **patcher9x** project's notes are the clearest account I found of why Windows 9x trips on modern CPUs.

## What to take into your own retro project

This series started with wanting to type `FIZZ.EXE` at a DOS prompt and bounce on a pogo stick. It ends on a Windows 95 desktop, with Rust programs that ask for things in the dialect that desktop speaks.

In between are three executable formats, go32, NE and PE, and three different agreements about what the machine provides. The part I'd carry into any future project is the freedom that separation gives you. Write the rules of a game, the pages of a document or the steps of an installer in modern Rust. Then pick one small thing an old machine already knows how to do, and see whether you can ask for it in its own language.
