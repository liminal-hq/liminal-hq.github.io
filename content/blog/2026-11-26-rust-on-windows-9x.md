---
title: "Cross-compiling to the past, part 3: Rust on Windows 95, 98 and Me"
date: "2026-11-26"
slug: "rust-on-windows-9x"
excerpt: "Rust's standard library wants Windows 10. Windows Me shipped in 2000. A 2,560-byte no_std program, a handful of raw-dylib imports and four linker flags close the gap, all from a Linux machine with no Windows SDK."
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
> 2. [Rust on Windows 3.1](/blog/rust-on-windows-3-1): 16-bit code, a hand-built NE executable, and what Windows does to your registers.
> 3. **Rust on Windows 9x** (this post): 32-bit Windows 95, 98 and Me, on Rust's own Windows target.

![A Windows Me desktop with a window titled "Rust on Windows ME" that reads "Hello from Rust on Windows ME!"](/blog/rust-on-windows-9x/me-hello.png)
_me-hello.exe on Windows Me (4.90.3000) in VirtualBox. Built by Rust 1.98 on Linux, 2,560 bytes. The Z: drive is a network share from the Linux host, unplugged for this screenshot, so the listing politely reports it missing._

The program in that window was compiled by a Rust toolchain released in August 2026. The operating system around it came out in September 2000. Between the two sit twenty-six years of Windows changes, and nearly every one of them is a reason the program should not run.

It runs anyway. This post covers the handful of things that had to go right, each checked against the bytes on disk, and why we care: Windows 95, 98 and Me are the next stop for Liminal Installer, our cross-platform installer project, after DOS and Windows 3.1.

![A pipeline diagram. On Linux: Rust source with no_std, no_main and raw-dylib imports goes to rustc 1.98 for i686-pc-windows-msvc with target-cpu=pentium, then to lld-link with /NODEFAULTLIB, /ENTRY:start, /SUBSYSTEM:WINDOWS,4.0 and /FIXED. The output, me-hello.exe, a 2,560-byte PE32 file with subsystem 4.0 and no relocations, goes by floppy image to Windows Me 4.90.3000 in VirtualBox, where it imports only kernel32.dll, user32.dll and gdi32.dll.](/blog/rust-on-windows-9x/pipeline.svg)
_The whole pipeline. The top row runs on Linux with no Windows SDK; the bottom row is a floppy image and a 26-year-old operating system._

## Why stock Rust won't start

Ask `cargo` for a normal hello world for `i686-pc-windows-msvc` and you get a program that Windows 9x cannot load, for three separate reasons.

The first is policy. Since Rust 1.78 the standard library on the regular Windows targets assumes Windows 10. There are tier-3 `*-win7-windows-msvc` targets that reach back to Windows 7, and nothing goes further. That is a reasonable call for a language that ships security fixes; it also means `std` is out of the question here.

The second is the C runtime. The linker command that `rustc` builds for a std program includes `"/defaultlib:msvcrt"`, which on a current Visual Studio means `vcruntime140.dll` and the Universal CRT. Neither has ever heard of Windows 98.

The third is the import table, and it is the one that would bite even if the first two were solved. Running `llvm-nm -u` over the 1.98 `libstd` rlib for this target lists 139 Win32 functions it can import. Thirty-eight end in `W`: `CreateFileW`, `GetCommandLineW`, `FindFirstFileExW` and friends. A few are much newer than that: `WaitOnAddress` and `GetSystemTimePreciseAsFileTime` arrived in Windows 8, and `ProcessPrng` newer still. Five more are `Nt*` calls straight into `ntdll.dll`. The `NTDLL.DLL` on our Windows Me machine is 20 KB and exports 48 functions; `NtCreateFile` is one of them, while `NtOpenFile`, `NtReadFile` and `NtWriteFile` are not.

On this Linux machine the std build does not get as far as the import table. With `lld-link` and no Windows SDK installed, it stops here:

```text
lld-link: error: could not open 'kernel32.lib': No such file or directory
lld-link: error: could not open 'ntdll.lib': No such file or directory
lld-link: error: could not open 'userenv.lib': No such file or directory
lld-link: error: could not open 'ws2_32.lib': No such file or directory
lld-link: error: could not open 'dbghelp.lib': No such file or directory
```

That failure turns out to be a useful hint. The fix for all three problems is to stop asking for things.

![A two-column table comparing stock Rust std with me-hello.exe: C runtime, import libraries, Win32 functions referenced, example imports, oldest Windows and file size.](/blog/rust-on-windows-9x/imports.svg)
_What a std program asks Windows for, next to what me-hello.exe asks for. The left column comes from `llvm-nm` on libstd; the right from the PE import table._

## The smallest program that opens a window

The reference project is a folder called `win9x-rust` with one `Cargo.toml`, one `.cargo/config.toml` and two programs: `src/main.rs`, which builds `me-hello.exe`, and `src/bin/me-files.rs`, a 737-line file manager. Both start the same way:

```rust
#![no_std]
#![no_main]
```

`no_std` drops the standard library: no `Vec`, no `String`, no `println!`, no allocator. `core` remains, with slices, iterators, `Option` and the rest of the language. `no_main` drops the runtime start-up code that would normally call `main`, which means we supply the entry point ourselves:

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

There is no C runtime underneath to return to, so the function's type is `-> !` and it ends by calling `ExitProcess`. Everything in between is the message loop from every Win32 tutorial written in 1996.

The window procedure handles two messages. `WM_PAINT` draws lines with `TextOutA` and lists the first twenty files on drive `Z:` with `FindFirstFileA` and `FindNextFileA`; `WM_DESTROY` posts the quit message. The structs (`WndClassA`, `Msg`, `PaintStruct`, `Win32FindDataA` and friends) are written out by hand with `#[repr(C)]`, about 70 lines copied field by field from the old headers.

Panics need somewhere to go, and with `panic = "abort"` in both Cargo profiles and no `std`, that somewhere is ours too:

```rust
#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    unsafe { ExitProcess(1) }
}
```

No message, no unwinding, no backtrace. The process ends with exit code 1, which is roughly what a 1999 program did on a bad day, minus the blue screen.

## Imports without an SDK

Normally a Windows program learns where `CreateWindowExA` lives from `user32.lib`, an import library that comes with the Windows SDK. We don't have the SDK and don't want it. Rust's `raw-dylib` link kind lets the compiler write the import table itself from the declarations in the source:

```rust
#[link(name = "user32", kind = "raw-dylib", import_name_type = "undecorated")]
extern "system" {
    fn RegisterClassA(class: *const WndClassA) -> u16;
    fn CreateWindowExA(/* twelve arguments */) -> Handle;
    fn GetMessageA(msg: *mut Msg, hwnd: Handle, min: u32, max: u32) -> i32;
    // ...
}
```

`import_name_type = "undecorated"` matters on 32-bit x86 and nowhere else. The `stdcall` convention decorates symbol names with a leading underscore and the size of the arguments in bytes, so `ExitProcess` becomes `_ExitProcess@4` inside the object files. The DLLs that ship with Windows export the plain name, `ExitProcess`. The attribute tells `rustc` to put the plain name in the import table, which is what the Windows 95 loader will look up. Leave the attribute off and the program still builds without a murmur, but its import table now asks `kernel32.dll` for `_ExitProcess@4` and `_FindClose@4`, names that no version of Windows has ever exported. We checked by building it both ways.

The result, read back from the finished file with `llvm-objdump -p me-hello.exe`:

```text
    DLL Name: kernel32.dll
    Hint/Ord  Name
           0  ExitProcess
           0  FindClose
           0  FindFirstFileA
           0  FindNextFileA
           0  GetModuleHandleA

    DLL Name: user32.dll
    Hint/Ord  Name
           0  BeginPaint
           0  CreateWindowExA
           0  DefWindowProcA
           0  DispatchMessageA
           0  EndPaint
           0  GetMessageA
           0  LoadCursorA
           0  PostQuitMessage
           0  RegisterClassA
           0  TranslateMessage

    DLL Name: gdi32.dll
    Hint/Ord  Name
           0  TextOutA
```

Sixteen functions in three DLLs, every one taking ANSI strings or no strings at all, every one present in Windows 95. The hints are all zero because the linker never saw the DLLs' export tables; the loader simply looks each name up.

The file manager's table has 24 entries. It swaps the painting calls for standard controls and brings in `GetLogicalDrives`, `SetErrorMode`, `DeleteFileA`, `RemoveDirectoryA`, `SendMessageA`, `MoveWindow`, `SetWindowTextA`, `SetFocus`, `MessageBoxA` and `GetStockObject`, plus one import from a fourth DLL: `ShellExecuteA` from `shell32.dll`, so that pressing Enter on a file opens it in whatever program Windows has associated with it. Still nothing with a `W` on the end.

## Why everything ends in A

Windows NT was Unicode inside from the start, and the `...W` functions are its native interface. Windows 95, 98 and Me were not. They kept strings in the active ANSI code page, Windows-1252 on an English install, and implemented only a handful of wide-character functions properly (`TextOutW` and `MessageBoxW` among them). Most of the rest exist as exports so that programs load, then fail with `ERROR_CALL_NOT_IMPLEMENTED` when called. Microsoft's eventual answer, the Microsoft Layer for Unicode (`unicows.dll`), arrived in 2001 as a separate download.

You can see the trick in the DLL itself. We copied `KERNEL32.DLL` off the Windows Me machine (by floppy, of course) and disassembled it. It exports 148 names ending in `W`. Here is `CreateFileW`, in full:

```text
bff99b5d <CreateFileW>:
bff99b5d:  xorl  %eax, %eax
bff99b5f:  movb  $0x7, %cl
bff99b61:  jmp   0xbff61319
```

Three instructions, then a jump to a shared stub that pushes `0x78` and calls `SetLastError`. `0x78` is 120, `ERROR_CALL_NOT_IMPLEMENTED`. `FindFirstFileExW` is the same three instructions with a different number in `cl`. A few wide functions are real: `GetCommandLineW` has an actual body. Guessing which is which at run time is no way to build a program, so we don't.

So the honest position for version one is: ANSI only, in the system code page, with no Unicode. File names come back from `FindFirstFileA` as bytes in Windows-1252 and are handed straight to `TextOutA` or a list box without being decoded. Rust's string literals are UTF-8, so the program keeps its own text to ASCII, where the two agree. Converting properly, through `MultiByteToWideChar` and `WideCharToMultiByte` (which 9x does implement), can wait for a program that needs it.

## Four linker flags for a 1999 loader

The rest of the work lives in `.cargo/config.toml`:

```toml
[build]
target = "i686-pc-windows-msvc"

[target.i686-pc-windows-msvc]
linker = "lld-link"
rustflags = [
    # Pentium-class codegen only: no SSE, which Windows 9x-era CPUs may lack.
    "-C", "target-cpu=pentium",
    # No CRT and no std, so the entry point is ours and nothing newer than Win98 gets imported.
    "-C", "link-arg=/NODEFAULTLIB",
    "-C", "link-arg=/ENTRY:start",
    # Subsystem version 4.0 is what the Windows 9x loader expects.
    "-C", "link-arg=/SUBSYSTEM:WINDOWS,4.0",
    # Windows 9x predates ASLR; load at the preferred base with no relocations.
    "-C", "link-arg=/FIXED",
    "-C", "link-arg=/DYNAMICBASE:NO",
]
```

`lld-link` is LLVM's drop-in for Microsoft's `link.exe`, and it runs on Linux. The rest, flag by flag:

- **`/NODEFAULTLIB`** tells the linker to ignore every library the object files ask for by default, which is how `msvcrt` stays out.
- **`/ENTRY:start`** points the PE entry point at our `start` function instead of the CRT's `mainCRTStartup`.
- **`/SUBSYSTEM:WINDOWS,4.0`** marks the file as a GUI program for Windows 4.0. `lld-link` stamps 6.0 (Windows Vista) if you don't say otherwise, and the 9x loader checks.
- **`/FIXED`** and **`/DYNAMICBASE:NO`** give the file a fixed load address of `0x00400000` with no relocation table and no ASLR flag. Windows 9x has no ASLR, and an EXE there always loads at its preferred base, so the relocations would only take up space.

The PE header shows all of it:

```text
Characteristics 0x123
	relocations stripped
	executable
	large address aware
	32 bit words
Magic                   010b	(PE32)
ImageBase               00400000
MajorOSystemVersion     4
MinorOSystemVersion     0
MajorSubsystemVersion   4
MinorSubsystemVersion   0
Subsystem               00000002	(Windows GUI)
```

To find out whether the loader really checks, we built a second copy with plain `/SUBSYSTEM:WINDOWS` and tried it on Windows Me:

![Two Windows Me error dialogs. The first, "Error Starting Program", says the A:\HELLO6.EXE file expects a newer version of Windows. The second says "A device attached to the system is not functioning."](/blog/rust-on-windows-9x/subsystem-6.png)
_The same program stamped with subsystem 6.0. Windows Me refuses it twice: once accurately, once with a message that has been confusing people since 1995._

We tried the other flag too. Without `/FIXED` and `/DYNAMICBASE:NO` the file grows from 2,560 to 3,072 bytes: a 56-byte `.reloc` section, padded to the 512-byte file alignment. That copy runs on Windows Me exactly like the original. The loader copes with relocations fine; it just never needs them for an EXE. So `/FIXED` is there to save space, and 512 bytes is 20% of this program.

## A Pentium, and a warning

`-C target-cpu=pentium` keeps the code generator to instructions a 1993 Pentium understands. The `i686` in the target name already rules out anything older than a Pentium Pro, and Rust's i686 targets go further and assume SSE2, which arrived with the Pentium 4 in 2000. Plenty of machines that ran Windows 98 had neither.

Rust 1.98 is not entirely happy about this:

```text
warning: target feature `sse2` must be enabled to ensure that the ABI of the
current target can be implemented correctly
  = note: this was previously accepted by the compiler but is being phased out;
          it will become a hard error in a future release!
```

The ABI problem is floating point: how Rust passes and returns floats on this target depends on SSE2 being present, and without it the compiler can't promise to follow its own rules. Neither program uses a single float, so the warning has nothing to bite. We checked: `llvm-objdump -d` over both binaries finds no `xmm` register, no MMX and no `cmov`. For the day this becomes an error, the way out is a custom target JSON that switches SSE off from the start. Liminal's DOS runtime already works that way: its target names an `i486` and lists `-mmx,-sse,-sse2` among the features. The price is `-Zbuild-std`, an unstable option that parts 1 and 2 unlock with `RUSTC_BOOTSTRAP=1`. This project gets by with plain stable Rust and no unstable flags, for now.

## The memcpy that nobody wrote

`me-hello` links with nothing but its three DLLs. `me-files` did not, the first time:

```text
lld-link: error: undefined symbol: _memcpy
```

The compiler emits calls to `memcpy`, `memset` and friends whenever it copies a large struct, and on MSVC targets it expects the C runtime to provide them. `compiler_builtins`, the small library that ships with `core`, has Rust versions, but it does not export them on this target because the CRT normally would. The DOS and Win16 builds in parts 1 and 2 get them by rebuilding `core` with the `compiler-builtins-mem` feature, which again means `-Zbuild-std`. On plain stable, with the CRT thrown away, the file manager brings its own:

```rust
#[no_mangle]
pub unsafe extern "C" fn memcpy(dst: *mut c_void, src: *const c_void, n: usize) -> *mut c_void {
    // esi is reserved by LLVM on x86, so swap the source pointer in and out of it.
    asm!("xchg {src}, esi", "rep movsb", "xchg {src}, esi",
         src = inout(reg) src => _, inout("ecx") n => _, inout("edi") dst => _,
         options(nostack, preserves_flags));
    dst
}
```

Two details in eight lines. A plain byte loop would be the obvious body, and LLVM would recognise it as a copy loop and replace it with a call to `memcpy`, which is this function, forever. Writing it as `rep movsb` in inline assembly puts it out of the optimiser's reach. And `rep movsb` reads from `esi`, a register LLVM keeps for itself on x86 and won't hand to an `asm!` block, hence the swap in and out. The same file defines `memmove`, `memset`, `memcmp` and `bcmp` so the next large copy doesn't send us back here. With LTO the copies are inlined: in the finished binary, `rep movsb` sits right after a `movl $0x110, %ecx`, copying a 272-byte directory entry when a row is opened or deleted.

## How big is it

```text
$ ls -l
-rwxr-xr-x 1 scott scott 8192 Oct 13 23:20 me-files.exe
-rwxr-xr-x 1 scott scott 2560 Oct 13 23:12 me-hello.exe
```

`me-hello.exe` is 1,024 bytes of headers (the MZ stub, still apologising that "This program cannot be run in DOS mode"), 512 bytes of code and 1,024 bytes of read-only data: strings, the import table and a 28-byte debug directory pointing at a `me_hello.pdb` that `strip = true` never got round to removing. The code itself is 501 bytes, 174 instructions.

`me-files.exe` is 8,192 bytes, with 4,730 bytes of code. Its whole state lives in one `static mut`: 1,024 directory entries with 260-byte names, a sort order and a path buffer. That is 280,932 bytes of `.data`, all zeros, and it takes up no space at all in the file, because the section header says so:

```text
Name: .data
VirtualSize: 0x44964
RawDataSize: 0
```

The loader allocates the memory and zeroes it. Windows 95 knew how to do that, too.

`opt-level = "z"`, LTO and a single codegen unit do some of the shrinking. Most of it comes from having no runtime: no CRT start-up, no panic formatting and no allocator.

## Getting it onto Windows Me

The test machine is a Windows Me virtual machine in VirtualBox on the same Linux box. VirtualBox has no Guest Additions for Windows 9x, so there is no drag and drop and no shared clipboard. Day to day, a batch file maps a network share from the host as `Z:` at login. For the screenshots we unplugged the virtual network cable and used the other classic: a floppy drive. A floppy image is a file `mtools` can write without root:

```sh
mformat -C -f 1440 -i a.img ::
mcopy -i a.img me-hello.exe me-files.exe ::
VBoxManage storageattach "Windows ME" --storagectl Floppy \
  --port 0 --device 0 --type fdd --medium a.img
```

A 1.44 MB floppy holds both programs about 140 times over. From there it is Start, Run, `A:\me-hello.exe`. There is no mouse in this story: VirtualBox's command line can type keys into a guest (`VBoxManage controlvm "Windows ME" keyboardputstring` and `keyboardputscancode`) and take screenshots of it (`screenshotpng`), so every window in this post was opened from the keyboard, with Win+R, Alt+F4 and a lot of Tab.

![The Windows Me Run dialog with A:\me-hello.exe typed into the Open box, above the taskbar and Start button.](/blog/rust-on-windows-9x/run.png)
_Start, Run. Some things never needed improving._

![The Windows Me file Properties dialog for ME-HELLO on drive A:, showing a size of 2.50 KB (2,560 bytes).](/blog/rust-on-windows-9x/properties.png)
_Windows Me agrees about the size: 2.50 KB (2,560 bytes). The dates are the day the floppy image was written._

`me-files` is the more convincing test, because it touches more of the system: a combo box of drives from `GetLogicalDrives`, a path label, a tab-stopped list box sorted folders-first with an insertion sort over an index array, and a status line. Enter opens, Backspace goes up, Delete removes after a `MessageBoxA` confirmation, F4 drops down the drive list and F5 refreshes. It calls `SetErrorMode(SEM_FAILCRITICALERRORS)` at start-up and skips `A:` and `B:` in the drive list, so an empty floppy drive never stops it with a critical-error box, the Windows descendant of "Abort, Retry, Fail?".

![A window titled "Rust File Manager" with a C: drive selector, the path C:\, and a list of folders and files from the root of the Windows Me drive with their sizes, above a status line listing the keyboard shortcuts.](/blog/rust-on-windows-9x/me-files.png)
_me-files.exe listing C:\ on Windows Me: 28 items, folders first, sizes rounded up to the kilobyte. 8,192 bytes of program, standard Win32 controls only._

The shared folder the programs were developed against still holds its test fixtures: an empty `app-1` folder, a `notes.txt` that reads, in its entirety, `readme test`, and a `scratch-folder` containing a `delete-me.txt` that has so far survived.

For the record, here is the machine, as Windows Me sees it:

![The Windows Me System Properties dialog: Microsoft Windows Me 4.90.3000, AuthenticAMD, AMD Ryzen 7 7700X 8-Core, 512.0MB RAM. The product ID is redacted.](/blog/rust-on-windows-9x/system-properties.png)
_Windows Me 4.90.3000 on a Ryzen 7 7700X, a processor about 22 years younger than the operating system. Our code still sticks to Pentium instructions; the CPU would not mind either way._

One thing did break during testing, and it wasn't Rust. The first boot for these screenshots froze solid about 45 seconds in, right after Windows Me opened the sound device: the log ends with the audio back end opening the host's ALSA output, and the virtual CPU never ran another instruction. Switching the VM's audio driver to `null` for the session fixed it. Retro computing, where the hard part is sometimes the sound card.

### And under Wine

Wine is the quick check before booting a VM. Both programs run under Wine 11.21 on the same Linux machine, with one amusing difference: Wine maps `Z:` to the Linux root directory, so `me-hello`'s "Contents of Z:\\ (the shared folder)" lists `bin`, `boot`, `etc` and `home`. Wine is a good test that the import table is sane. It is no test of the Windows 9x loader: the subsystem 6.0 build that Windows Me rejected twice opens under Wine without a word of complaint. The VM gets the final say.

## What has and hasn't been tested

- **Windows Me** (4.90.3000) in VirtualBox: both programs run, as the screenshots show.
- **Wine 11.21** on Linux: both programs run.
- **Windows 95 and Windows 98**: not tested, in a VM or on real hardware. Everything the programs import exists on Windows 95, the PE header asks for 4.0, and nothing uses an instruction a Pentium lacks, so we expect them to work. Expecting is not testing, and we'll update this post when one of them gets booted.
- **Real hardware** of any kind: not yet.

## Where this goes: Liminal Installer on Windows 9x

Liminal Installer takes one installer project and builds it for each kind of machine, with a renderer to match. Its DOS runtime already exists: a `no_std` Rust `SETUP.EXE` whose core, `li-retro`, holds the compiled project format, the condition and flow VMs, a text-mode renderer and the installer engine, with a thin platform crate underneath for the screen, keys and files. Part 2 of this series covered the Windows 3.1 side.

Everything in this section is **planned, not built**. The 32-bit Windows piece is the `win32-classic` renderer: plain Win32 controls, bevelled 90s dialogs and tiny downloads, for Windows 95 through 11. The idea is a `li-win9x-rt` runtime that drives the same shared `no_std` flow VM as the DOS runtime and swaps the text-mode platform for native dialogs through `user32` and `comctl32`, using exactly the recipe in this post: `raw-dylib` imports, ANSI entry points, subsystem 4.0, no CRT. If a file manager fits in 8 KB, a setup wizard should leave most of a floppy for the payload.

A note on the Windows 3.1 work from part 2: Windows 95, 98 and Me still carry the Win16 subsystem, and part 2's 16-bit `SETUP.EXE` ran to its last page on this same Windows Me VM. Whether it does the same on 95 and 98 is untested. Either way it is a bonus on these systems. The plan for Windows 95 and later is the 32-bit installer, which can use long file names, the registry and the 32-bit common controls without any thunking.

## What comes next

The installer is half the reason for this series. The other half is Quill, a small rich-text word processor for DOS, Windows 3.1 and Windows 95, 98 and Me, written in Rust from one shared core. It is still in the planning stage as a local experiment, and its 32-bit Windows build will come from exactly the approach in this post: `no_std`, `raw-dylib`, `...A` functions and a loader from 1995. Once there is a Quill to show, a capstone post will follow with the word processor and the installer that ships it, on all three platforms.
