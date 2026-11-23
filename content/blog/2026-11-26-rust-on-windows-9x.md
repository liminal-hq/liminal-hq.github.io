---
title: "Cross-compiling to the past, part 3: Rust on Windows 95, 98 and Me"
date: "2026-11-26"
slug: "rust-on-windows-9x"
excerpt: "Windows 95 runs Win32 programs, and Rust builds Win32 programs, yet a Rust hello world won't start on Windows 95. The reason is that 9x speaks its own dialect of Win32. Learning it took a 2,560-byte no_std program, a few linker flags and an import allowlist, and the installer and Quill now build on that recipe."
tags:
  - "Cross-compilation"
  - "Rust"
  - "Windows 9x"
  - "Windows Me"
  - "Win32"
  - "Liminal Installer"
draft: true
---

> **In this series: Cross-compiling to the past**
>
> 1. [Rust on DOS](/blog/rust-on-dos): a 32-bit protected-mode runtime, a packer, and a DOS installer.
> 2. [Rust on Windows 3.1](/blog/rust-on-windows-3-1): 16-bit code, a hand-built NE executable, and a crash that arrives with the timer.
> 3. **Rust on Windows 95, 98 and Me** (this post): why "any Win32 program" doesn't include Rust's, and what it takes to change that.

Windows 95 runs Win32 programs. Rust builds Win32 programs. Put the two together, and a stock Rust hello world still can't run there. After two parts of this series spent on systems Rust doesn't target, this was supposed to be the easy one.

![A Windows 95 desktop with a window titled "Rust on Windows ME" that reads "Hello from Rust on Windows ME!", "no_std, i686-pc-windows-msvc, linked with lld-link", and a note that drive Z: is not mapped](/blog/rust-on-windows-9x/win95-me-hello.png)
*`me-hello.exe` on Windows 95 OSR2.5 in DOSBox-X. It was written for Windows Me, hence the title, and it ran on 95 unchanged: 2,560 bytes, built by Rust 1.98 on Linux.*

The program in that window does start, because it was written against a different picture of what Windows 95 is. This post is about that picture. The usual one, "Win32 is Win32", breaks in a few specific places, and once you see where, everything Liminal HQ has since built for these systems follows from it.

## The belief: a 32-bit Windows program runs on any 32-bit Windows

It's a reasonable belief. Windows 95 brought the Win32 API to home PCs in 1995, Windows NT had it from 1993, and the function names match: `CreateWindowExA`, `GetMessageA`, `CreateFileW`. Most programs of the late 1990s ran on both. Plenty of people, me included, carried that assumption forward to "a 32-bit Windows program built today runs on Windows 95, if nothing in it is too new".

The Liminal Installer needed to know whether that held. After DOS and Windows 3.1, Windows 95, 98 and Me are the next systems its retro runtimes cover, and Quill, the word processor that has been following this series, wants a build for them too.

## A Rust hello world breaks it three ways

Ask `cargo` for a normal hello world for `i686-pc-windows-msvc` and you get a program that Windows 9x can't load.

The first reason is policy. Since Rust 1.78, the standard library on the regular Windows targets assumes Windows 10, and the tier-3 `*-win7-windows-msvc` targets reach back only to Windows 7. That's a fair call for a language that ships security fixes, and it puts `std` out of the question here.

The second is the C runtime. A `std` program links `msvcrt`, which on current Visual Studio means `vcruntime140.dll` and the Universal CRT, and neither has heard of Windows 98.

The third would bite even if the first two were solved. Running `llvm-nm -u` over the 1.98 `libstd` for this target lists 139 Win32 functions it can import. Thirty-eight end in `W`, such as `CreateFileW` and `GetCommandLineW`, and some arrived much later: `WaitOnAddress` in Windows 8, and `ProcessPrng` later still.

![A two-column table comparing stock Rust std with me-hello.exe: C runtime, import libraries, Win32 functions referenced, example imports, oldest Windows and file size.](/blog/rust-on-windows-9x/imports.svg)
_What a std program asks Windows for, next to what `me-hello.exe` asks for. The left column comes from `llvm-nm` on libstd, the right from the finished file's import table._

On this Linux machine, with no Windows SDK installed, the `std` build doesn't even reach the import table. It stops at the linker with `could not open 'kernel32.lib'` and four more like it. That failure turned out to be a useful hint: the fix for all three problems is to stop asking for things.

## Windows 9x speaks a dialect of Win32

Here is the model that replaced the belief. Windows NT was Unicode inside from the start, and its `...W` functions are its native interface. Windows 95, 98 and Me kept strings in the ANSI code page, Windows-1252 on an English install, and implemented only a handful of wide functions for real. The rest exist so that programs load, then fail when called.

It works like a regional dialect. The vocabulary looks the same, and a visitor who sticks to common words gets by. The analogy breaks in one useful place: a real dialect speaker would look puzzled at an unknown word, while Windows 9x nods along at load time and only fails when the word is used.

> **What a nod looks like.** I copied `KERNEL32.DLL` off the Windows Me machine, by floppy, and disassembled it. It exports 148 names ending in `W`. Here is `CreateFileW`, in full:
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

![Two Windows Me error dialogs. The first, "Error Starting Program", says the A:\HELLO6.EXE file expects a newer version of Windows. The second says "A device attached to the system is not functioning."](/blog/rust-on-windows-9x/subsystem-6.png)
_The same program stamped with subsystem 6.0. Windows Me refuses it twice: once accurately, and once with a message that has confused people since 1995._

## Writing in the dialect starts with `no_std`

The reference project, `win9x-rust`, has two programs: `me-hello`, the window at the top, and `me-files`, a 737-line file manager. Both drop the standard library and its start-up code with `#![no_std]` and `#![no_main]`, so the entry point is theirs to write:

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

The finished `me-hello.exe` imports 16 functions from `kernel32`, `user32` and `gdi32`, and every one takes ANSI strings or none. The file manager imports 24, adding `ShellExecuteA` so Enter opens a file in its associated program. Neither has anything ending in `W`, and on the 9x side that means file names are bytes in the system code page, handed to the screen without decoding. Rust's literals are UTF-8, so the programs keep their own text to ASCII, where the two agree.

## Four linker flags speak to a 1995 loader

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

Subsystem 4.0 is the flag the loader enforces. `/FIXED` is about size: an EXE on Windows 9x always loads at its preferred base, so a relocation table is dead weight. Without it the file grows from 2,560 to 3,072 bytes, and that copy runs on Windows Me exactly like the original.

`target-cpu=pentium` is the CPU half of the dialect. Rust's i686 targets assume SSE2, which arrived with the Pentium 4 in 2000, and plenty of machines that ran Windows 95 and 98 had no SSE at all. Rust 1.98 warns that turning SSE2 off on this target "is being phased out" and will become a hard error, because it changes how floats are passed. Neither program uses a float, and `llvm-objdump` finds no `xmm` register and no `cmov` in either binary.

> **The memcpy nobody wrote.** The file manager first failed to link with `undefined symbol: _memcpy`. The compiler emits calls to `memcpy` for large copies and expects the C runtime to supply it. With the runtime gone, `me-files` defines its own, as a `rep movsb` in inline assembly. A plain byte loop would be the obvious body, but LLVM recognises copy loops and replaces them with a call to `memcpy`, which here would be the function calling itself forever.

## The model holds on a real Windows 95

The first version of this post could only say "Windows 95 and 98: not tested". Since then, a Windows 95 test bed has joined the installer repository. It runs Windows 95 OSR2.5 in DOSBox-X 2025.02.01, headless, from a read-only disk image with a throwaway copy per run, and drives the guest with typed keys and slow, one-pixel mouse steps.

OSR2.5 isn't the 1995 retail floor, and the test bed records exactly what it is. Its `KERNEL32.DLL` and `SHELL32.DLL` are 4.00.1111, newer than retail's 4.00.950, and its `COMCTL32.DLL` is 4.70. A second image adds Internet Explorer 4.01 from the same disc, which brings the common controls up to 4.72.

Both reference programs ran on it unchanged, as the screenshot at the top shows. The file manager listed the drive, sorted folders first, and opened a folder on a double click under the IE4 image.

![A Windows 95 window titled Rust File Manager listing C:\ with Program Files, WIN95 and WINDOWS folders, then files such as AUTOEXEC.BAT, COMMAND.COM and IO.SYS with sizes, above a status line of keyboard shortcuts](/blog/rust-on-windows-9x/win95-me-files.png)
*`me-files.exe` on Windows 95 OSR2.5: 19 items on `C:`, folders first. The program is 8,192 bytes.*

Quill's Win32 build runs there too, with its menus, the two-row toolbar and the ruler. It's built the same way as the reference programs, with its imports held to a 96-entry allowlist and no `...W` entry points.

![Quill on Windows 95: a window titled Quill - (Untitled) with a menu bar, a toolbar of file and edit buttons, a formatting bar with Normal, Times New Roman and 12 in drop-down boxes, bold, italic and underline buttons, alignment buttons, a ruler marked in inches and an empty page](/blog/rust-on-windows-9x/win95-quill.png)
*`QUILL32.EXE` on Windows 95 OSR2.5 at 640 by 480 in 16 colours, the test bed's standard VGA mode.*

## The installer turns the dialect into a build rule

The installer's Win32 runtime is where the model stops being an observation and becomes a check that fails the build. Its `SETUP.EXE` runs the same flow VM and install engine as the DOS runtime from [Part 1](/blog/rust-on-dos), drawn with real Windows controls: check boxes, a `msctls_progress32` progress bar, and the shell's folder browser.

Three checks run in CI.

`check-imports.sh` fails on any import that isn't on a 94-entry allowlist of functions Windows 95 exports, and on any name ending in `W`. `check-pe.sh` requires a PE32 GUI program with subsystem 4.0 and no relocations. `scan-pentium.sh` fails on any MMX, SSE or `cmov` instruction.

The allowlist was checked by hand against the Win32 reference, and nobody has yet read it off a Windows 95 disk. The test bed is now the place to close that gap.

The CPU rule went further than in `win9x-rust`. The prebuilt `core` that Rust ships for `i686-pc-windows-msvc` was compiled assuming SSE2, and its library holds 812 `xmm` references and 618 `cmov` lines, so a stock build would fault on a Pentium, a Pentium MMX or an AMD K6, the machines Windows 95 ran on. The installer builds `core` from source for its own `i586` target with MMX, SSE and the x87 switched off, which is the custom-target escape hatch the first version of this post predicted.

The result is about 135 KB as merged, and 115,200 bytes on the branch with Part 2's hand-written decoder. Under Wine, it installs and uninstalls Lieutenant Fizz and Planboard, with every page equal to its golden and the Start menu shortcut, the Add/Remove Programs entry and the files all checked, then checked again for removal. It has not yet run on Windows 95, 98 or Me. The test bed exists now, so that's the next run.

## The Windows Me machine that froze

One part of this story wasn't Rust at all. The Windows Me virtual machine, the one behind every Me screenshot in this series, froze more than once in VirtualBox 7.2.22. One session's log is unusually clear about the moment:

```text
00:01:52.996386 ALSA: Using output device "default"
00:01:53.291833 Changing the VM state from 'RUNNING' to 'GURU_MEDITATION'
00:01:53.292036 !!         VCPU0: Guru Meditation 1155 (VINF_EM_TRIPLE_FAULT)
```

A **triple fault** is the x86's last resort: a fault while handling a fault while handling a fault, after which a real PC resets. It came 0.3 seconds after the virtual sound card opened its output. The CPU was in ring 0 at `C0015774`, in the address range where Windows Me keeps its system code, and the last page fault was on the stack pointer's own address, so the system had lost its own stack.

Other details in the logs are suspicious without being proof. The host CPU runs at 4.5 GHz, and VirtualBox gave the guest a time-stamp counter of 4,294,967,295 ticks a second, the largest number 32 bits can hold. The VM also used a USB tablet for its pointer and had a USB 2.0 controller, which Windows Me shipped without a driver for.

> **Known bugs in Windows 9x on fast CPUs.** The community project [patcher9x](https://github.com/JHRobotics/patcher9x) patches two that matter here. Windows 95 and the first edition of 98 divide by zero in a CPU speed test on processors of about 2 GHz and faster, and Windows 98, 98 SE and Me have a TLB invalidation bug that shows on AMD Zen 2 and Intel 11th-generation CPUs and newer. On Me, the project notes, the affected code runs rarely, during driver installs and system updates. The [patcher9x thread on VOGONS](https://www.vogons.org/viewtopic.php?f=24&t=88284) has the long version. I haven't applied either patch.

What changed since: the guest counter is pinned at 1 GHz, the USB 2.0 controller is gone, the pointer is a PS/2 mouse and the audio is off. The next session ran for 12 minutes and shut down normally. That's one clean run after four changes, so the cause isn't proven, and I can't say which change mattered. If you run Windows Me on a modern machine and it freezes, those four settings are where I'd look first.

![The Windows Me System Properties dialog: Microsoft Windows Me 4.90.3000, AuthenticAMD, AMD Ryzen 7 7700X 8-Core, 512.0MB RAM. The product ID is redacted.](/blog/rust-on-windows-9x/system-properties.png)
_The Windows Me VM as it sees itself: version 4.90.3000 on a Ryzen 7 7700X, a processor about 22 years younger than the operating system._

## What has and hasn't been tested

- `me-hello` and `me-files` run on Windows Me 4.90.3000 in VirtualBox, on Windows 95 OSR2.5 in DOSBox-X, and under Wine 11.21.
- Quill's Win32 build runs on Windows 95 OSR2.5 in the test bed, and its earlier milestones ran on the Windows Me VM.
- The installer's Win32 `SETUP.EXE` has run only under Wine.
- Not tested: retail Windows 95 (4.00.950), Windows 98, and any real hardware.
- Wine is a sanity check only. The subsystem 6.0 build that Windows Me refused twice opens under Wine without a word.

## Next

So Windows 95 doesn't run every Win32 program. It runs programs written in its dialect: ANSI functions only, subsystem 4.0, nothing newer than a Pentium, and nothing from a C runtime it never shipped. Rust can write that dialect from a Linux machine with no Windows SDK, as long as checks in the build hold it to the rules.

That's the last of the three platforms. Quill runs on DOS and Windows 95 from one Rust core, and its first Windows 3.11 test programs pass. The installer that will ship it has working runtimes for DOS and Windows 95 and two halves of one for Windows 3.1. A capstone post will put them together once Quill reaches its first release disks.
