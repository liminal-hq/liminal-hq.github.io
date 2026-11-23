---
title: "Cross-compiling to the past, part 2: Rust on Windows 3.1"
date: "2026-11-25"
slug: "rust-on-windows-3-1"
excerpt: "There is no Win16 target in Rust either. LLVM's 16-bit mode, rust-lld and our own NE packer got a 620-byte Rust message box and a 14.9 KB installer running on Windows for Workgroups 3.11, after six bugs that only the real thing could find."
tags:
  - "Cross-compilation"
  - "Rust"
  - "Windows 3.1"
  - "Win16"
  - "Liminal Installer"
draft: true
---

> **In this series: Cross-compiling to the past**
>
> 1. [Rust on DOS](/blog/rust-on-dos): a 32-bit protected-mode runtime, a packer, and a DOS installer.
> 2. **Rust on Windows 3.1** (this post): 16-bit code, a hand-built NE executable, and what Windows does to your registers.
> 3. [Rust on Windows 9x](/blog/rust-on-windows-9x): 32-bit Windows 95, 98 and Me.

![Windows for Workgroups 3.11's Program Manager with a Liminal Setup dialog in front: "Welcome to the Liminal Win16 installer spike. This program is Rust, built for a 16-bit code segment, and carries one file as a resource", with Next and Cancel buttons](/blog/rust-on-windows-3-1/wfw311-welcome.png)
*`SETUP.EXE` on Windows for Workgroups 3.11 in DOSBox-X. The dialog is a native Win16 dialog resource, and everything behind it came with the pre-installed Windows tree we tested on.*

[Part 1](/blog/rust-on-dos) ended with Rust running on DOS in 32-bit protected mode, where the address space is flat and a pointer is just a number. Windows 3.1 offers no such comfort. A Windows 3.1 program lives in 16-bit segments of at most 64 KiB, calls the operating system through far pointers whose segment halves are not known until the program is loaded, and ships in a file format that no Rust toolchain writes.

The usual escape hatch is Win32s, Microsoft's add-on that let a subset of 32-bit Windows programs run on Windows 3.1. We ruled it out: it would be one more thing to install before our installer could run, and an installer that needs an installer is a hard sell.

So the question for the [Liminal Installer](https://github.com/liminal-hq-labs/liminal-installer) was blunt: can its Windows 3.1 runtime be a real 16-bit Windows program, written in Rust? Until now the answer for Win16 was C, built with Open Watcom. This post is the spike that tried Rust. It works, with limits, and getting there taught us a few things about Windows 3.11 that Wine was too polite to mention.

## What a Win16 program has to be

A Windows 3.x executable is an **NE** file, for New Executable. It starts with an ordinary DOS MZ header, so that running it from a DOS prompt prints a message instead of crashing. Then comes the NE header and a run of tables: segments, relocations, exported names, imported modules and resources such as dialogs and strings.

Code and data live in **segments**, each reached through a selector that Windows hands out at load time. Your program does not know its own selectors when it is linked, and it certainly does not know where `USER.EXE` will put `MessageBox`. Every call into Windows is a far call whose target the loader writes into your code as it loads it. NE calls these fixups.

Windows functions use the **Pascal** calling convention: arguments are pushed left to right, the callee pops them, and a 32-bit value travels as two 16-bit words. Imports are usually by ordinal, a number per function. `MessageBox` is `USER.1`, and the one function every Windows program must call first is `INITTASK`, `KERNEL.91`.

None of this resembles what `rustc` produces. The job, again, splits in three: get Rust to emit code that can live in a 16-bit segment, turn the linked result into an NE file, and bridge every call between Rust's conventions and Windows'.

## A 16-bit target that is mostly 32-bit

LLVM has a mode for one niche: x86 boot code. The target triple `i386-unknown-none-code16` emits code for a 16-bit code segment, the mode the rust-osdev real-mode bootloader stages use. The trick is that most instructions are still 32-bit ones, carrying an operand-size prefix (`66h`) or an address-size prefix (`67h`) that a 386 honours in a 16-bit segment.

The target spec, `retro/win16/win16.json`, is a close cousin of Part 1's:

```json
{
  "llvm-target": "i386-unknown-none-code16",
  "arch": "x86",
  "os": "none",
  "cpu": "i386",
  "features": "-mmx,-sse,-sse2,-sse3,-ssse3,-sse4.1,-sse4.2,-avx,-x87",
  "panic-strategy": "abort",
  "relocation-model": "static",
  "linker": "rust-lld",
  "linker-flavor": "ld.lld",
  "rustc-abi": "softfloat"
}
```

That is trimmed, as before. Floating point is software (`-x87`), so a 386 without a maths coprocessor is fine, and Rust 1.98.0 grumbled only that soft float is being phased out. The build is the same shape as on DOS: `RUSTC_BOOTSTRAP=1`, `build-std = ["core", "alloc"]` and `compiler-builtins-mem`.

Here is a slice of the smallest program, disassembled as 16-bit code:

```text
  ab:   66 6a 00              pushd  0x0
  bd:   66 e8 91 ff ff ff     calld  54 <MessageBox>
  c3:   66 83 c4 10           add    esp,0x10
  ca:   66 c3                 retd
  d2:   67 66 8b 74 24 14     mov    esi,DWORD PTR [esp+0x14]
```

Every call between Rust functions is a 32-bit near call with a four-byte return address. Every stack access goes through ESP, all 32 bits of it. Hold on to that second fact; Windows is going to break it.

It also settles the hardware floor before anything runs. A 286 has no 32-bit registers, so this code needs a 386, and Windows 3.1's Standard mode on a 286 is out. 386 Enhanced mode, Windows for Workgroups 3.11, and Windows 95, 98 and Me all remain.

## A linker script with an overlay

The linker turned out to be the hard part of the toolchain. In an NE file, the code segment and the data segment each start at offset 0 of their own selector. So `.text` must be linked at address 0, and so must `.data`. `rust-lld` refuses that outright: `virtual address range overlaps`.

The way around it is an `OVERLAY`, a linker-script feature from the days when programs swapped pieces of themselves in and out of the same memory:

```text
SECTIONS {
  OVERLAY 0 : AT(0x1000) {
    .text {
      *(.text.start)
      *(.text .text.*)
    }
    .data {
      KEEP(*(.data.00_reserved))
      *(.rodata .rodata.*)
      *(.data .data.*)
      *(.bss .bss.*)
      *(COMMON)
    }
  }
  /DISCARD/ : { *(.eh_frame*) *(.comment) *(.note*) *(.gcc_except_table*) }
}
```

Both sections get address 0 and sit one after the other in the file; `objdump -h` on the linked message box shows `.text` and `.data` both at VMA 0. `.rodata` joins the data segment because Rust code reaches string literals through DS.

The odd one out is `.data.00_reserved`, 16 bytes of zeros that must come first. Windows keeps heap and stack bookkeeping in the first 16 bytes of a program's data segment. The first build had no reservation, the program's first string sat right there, and the message box read "Hello P omÅ".

![The build pipeline: Rust crates are compiled by rustc with -Zbuild-std for win16.json, linked by rust-lld with link.ld into an ELF whose code and data both start at 0, packed by ne_pack.py with resources into SETUP.EXE, and loaded by Windows](/blog/rust-on-windows-3-1/build-pipeline.svg)
*From Rust source to an NE executable. The sizes are from a fresh build of the installer proof for this post.*

## Import stubs, generated from Wine

Rust calls functions with 32-bit arguments, a near call and the caller cleaning up. Windows wants Pascal order, 16-bit words, far pointers and a far call. Something has to sit in between, once per Windows function, so we generate it. `tools/imports.tbl` has 64 rows, each with an ordinal and a tiny signature:

```text
KERNEL 15 GlobalAlloc wl w
KERNEL 83 _lcreat pw w
USER 1 MessageBox wppw w
USER 87 DialogBox wlwf w
```

Each letter is one argument: `w` a word, `l` a long, `p` a data pointer sent as `DS:offset`, `f` a code pointer sent as `CS:offset`; the last field is the return type. The ordinals and argument counts come from Wine's `.spec` files for `krnl386.exe16`, `user.exe16` and `gdi.exe16`, and `gen_imports.py --check-spec` checks every row against them.

The generator writes one `global_asm!` stub per row into `src/imports.rs`. Here is `MessageBox`, lightly trimmed:

```text
MessageBox:
  push ebp
  mov  bp, sp
  ...                      ; save EBX, ESI and EDI
  push word ptr [bp+8]     ; hwnd
  push ds
  push word ptr [bp+12]    ; text, as DS:offset
  push ds
  push word ptr [bp+16]    ; caption, as DS:offset
  push word ptr [bp+20]    ; style
  call far 0000:0000       ; operand labelled __w16imp_USER_1_MessageBox
  movzx esp, sp
  push ds
  pop  es
  movzx eax, ax
  ...                      ; restore EDI, ESI, EBX and EBP
  retd
```

The label on the far call's operand is the whole interface between generator and packer: module, ordinal and location are all in the symbol, and the packer reads the ELF symbol table to find them. The register saves, the `movzx esp, sp` and the `push ds; pop es` look like paranoia. Each is there because of something Windows 3.11 did, which we will get to.

Calls the other way, into window and dialog procedures, go through `export_proc!`. It loads DS and ES from SS (a callback runs on the task's own stack, so no `MakeProcInstance` thunk is needed), saves registers, widens the four arguments, calls Rust, returns in DX:AX and ends with `retf 10`. The packer finds it by its `__w16exp_` label and adds an entry-table record.

## The packer, and how it differs from DOS

Part 1's DOS packer, `elf2go32.py`, was 139 lines, because a DOS image is one flat 32-bit block: `rust-lld` resolves every address, a borrowed DJGPP stub does the loading, and there are no relocations. `ne_pack.py` is about 380 lines, and the difference is the loader. On Windows nothing is resolved until load time, so the packer must describe every gap for the loader to fill.

| | DOS (`elf2go32.py`) | Win16 (`ne_pack.py`) |
|---|---|---|
| Reads | ELF program headers | ELF section headers and the symbol table |
| Address space | One flat 32-bit block | A code segment and a data segment, each from offset 0, at most 64 KiB |
| Loader | DJGPP's stub and a DPMI host, borrowed | Windows' own KERNEL |
| Relocations | None; the linker resolved everything | One fixup per import, by module and ordinal |
| Extras | None | Entry table for callbacks, name tables, resources |
| Stub | 2 KiB to 22 KiB of borrowed loader | 128 bytes of our own that print one line |

Resources come from a small JSON file per program: dialogs with their controls, a string table, and raw data such as the file the installer copies.

![Byte layout of MSGBOX.EXE: MZ stub at 0x000, NE header at 0x080, segment table at 0x0C0, name tables at 0x0D0, the 261-byte code segment at 0x110 with four far-call sites, four relocation records at 0x215 pointing back at those sites, and the 44-byte data segment at 0x240](/blog/rust-on-windows-3-1/msgbox-ne-layout.svg)
*The whole of `MSGBOX.EXE`. The four orange bands are the far calls the loader patches.*

To keep ourselves honest, `ne_dump.py` is a separate NE reader that shares no code with the packer. Sixteen `unittest` cases pack a synthetic ELF and read it back, and an optional one checks the header and segment fields against Open Watcom's `wlink` output for the same message box. On a fresh build, trimmed:

```text
$ ne_dump.py MSGBOX.EXE
  flags          0x302
  autodata       0x2
  heap           0x1000
  stack          0x2000
  expected_ver   0x30a
modules: ['KERNEL', 'USER']
segment 1: file_off=0x110 len=0x105 flags=0x0d40 minalloc=0x105
    {..., 'additive': False, 'offset': 1, 'module': 1, 'ordinal': 91}
    {..., 'additive': False, 'offset': 60, 'module': 2, 'ordinal': 5}
    {..., 'additive': False, 'offset': 109, 'module': 2, 'ordinal': 1}
    {..., 'additive': False, 'offset': 147, 'module': 1, 'ordinal': 30}
segment 2: file_off=0x240 len=0x2c flags=0x0c41 minalloc=0x2c
```

Two segments, four imports. The first fixup is at offset 1, because the program's very first instruction is the far call to `INITTASK`.

## Starting a task

A C program for Windows 3.1 has a startup routine in its runtime library that calls `INITTASK`, `WaitEvent` and `InitApp` before `WinMain`. We have no C runtime, so `_start` in `src/lib.rs` does that job:

```text
_start:
  call far KERNEL.91         ; INITTASK, the first instruction
  or   ax, ax
  jz   fail
  xor  bp, bp
  movzx esp, sp
  push ds
  pop  es
  cld
  ...                        ; widen hInstance, hPrevInstance, nCmdShow
  calld w16_entry            ; WaitEvent(0), InitApp(hInst), w16_main
fail:
  mov  ah, 0x4c
  int  0x21
```

`INITTASK` reads the registers Windows started the task with, so it has to be literally first: an earlier version cleared the high half of ESP one instruction sooner, and the task died inside `INITTASK`. The program supplies `w16_main`, the Rust `WinMain`. The smallest is all of `msgbox.rs`:

```rust
#[unsafe(no_mangle)]
pub extern "C" fn w16_main(_hinst: u32, _hprev: u32, _show: u32) -> u32 {
	unsafe { MessageBox(0, cs!("Hello from Rust"), cs!("Win16"), MB_OK) };
	0
}
```

That builds to a 620-byte executable. The same program in C, built with Open Watcom's `wcl -bt=windows`, is 1,478 bytes (1,250 with `-os -s`), mostly because Open Watcom's startup and stack-checking code comes along in every executable. Being smaller than C is a fun result, though not a fair fight: Open Watcom's 862 bytes of code run on a 286, and our 261 do not.

![Program Manager on Windows for Workgroups 3.11 with a message box titled Liminal reading "Hello from Rust, in 16-bit Windows" and an OK button](/blog/rust-on-windows-3-1/wfw311-hello.png)
*`HELLO.EXE` on Windows for Workgroups 3.11. After this box it registers a window class, creates a window, paints it with `TextOut`, runs a message loop and opens a three-page wizard dialog from its resources.*

## Six bugs that only real Windows found

We tested on three systems: Windows for Workgroups 3.11 in DOSBox-X, Windows Me in VirtualBox, and Wine 11.21, which still runs Win16 programs under its new WoW64 mode. Wine was the fastest loop and the most forgiving. Each of these six problems passed on Wine or looked right on paper, then failed on Windows 3.11:

1. **"Insufficient memory to run this application."** A fixup that is not additive is a link in a chain: the loader reads the offset of the *next* fixup from the spot it is about to patch, and `0xFFFF` ends the chain. The linker left zeros there, so the loader followed the chain to offset 0 and gave up with the least helpful error message in Windows. The packer now writes `0xFFFF` into every site, which is why the first bytes of the code segment on disk are `9A FF FF 00 00`.
2. **A corrupted message box.** The "Hello P omÅ" from earlier. Fixed by the 16-byte reservation at the start of the data segment.
3. **The task died inside `INITTASK`.** One `movzx esp, sp` before the call was enough.
4. **The dialog never opened.** NE resource lengths are counted in alignment units, not bytes, and the file was a few bytes too short for what the table promised. The packer pads every resource, and because the exact size is now lost, raw data carries a four-byte length prefix.
5. **A General Protection Fault in `rep movsb`.** Windows does not preserve ES, and Rust's block copies use it. The stubs now reload ES from DS after every call.
6. **`_lcreat` failed after a `mkdir`.** The `INT 21h` call that makes the directory clobbered registers the compiler had been told were safe. The inline assembly now saves EBX, ESI and EDI around it.

Each one was found the old way: build, copy, boot Windows, look, think, repeat.

## What Windows does to your registers

The fifth bug raised a bigger question: if Windows does not keep ES, what else does it drop? A 16-bit Pascal function owes its caller only SI, DI, BP and DS, and nothing about the high halves of 32-bit registers. Rust keeps live values in EBX, ESI and EDI across calls, and addresses its stack through all of ESP.

So we measured it. `src/probe.rs` fills EBX, ESI, EDI and EBP with patterns whose high halves are not zero, makes one raw API call with no protective stub, and logs what came back. On Windows for Workgroups 3.11 in 386 Enhanced mode:

| Call | EBX | ESI, EDI, EBP | ESP |
|---|---|---|---|
| `GetVersion` | kept | kept | kept |
| `GlobalAlloc` | replaced (`0000121E`) | kept | kept |
| `PeekMessage` | replaced (`00000000`, later `111104D3`) | kept | high half became `8001` |
| `Yield` | kept, then high half zeroed after the dialogs | kept | high half `8001` after the dialogs |

Windows Me told the same story: `GlobalAlloc` and `PeekMessage` replaced EBX, and ESP's high half came back as `EA06` after `PeekMessage`. Wine kept everything, so Wine is no evidence here at all.

So BX is not kept even in its low half, which the convention allows. ESP can come back with junk in its high half, and the next `mov esi, [esp+0x14]` then points about 2 GiB past the end of a 64 KiB stack segment. A yielding call can change a register that an earlier call left alone. ESI, EDI and EBP survived every sample, but a sample is not a promise.

Hence the stub you saw earlier: every import stub and exported procedure saves EBX, ESI and EDI in full, clears the high half of ESP after the far call, and reloads ES. It costs a few bytes per stub, and `SETUP.EXE` stopped crashing.

## The installer proof

Then the smallest program that could fairly be called an installer. `SETUP.EXE`, 14,944 bytes:

1. Shows a three-page wizard from a dialog resource, driven by a small state machine in `src/wizard.rs`, with its text in the string table.
2. Opens a modeless progress dialog and copies in 128-byte chunks, with a `PeekMessage`, `IsDialogMessage` and `Yield` loop between them so the dialog repaints and Cancel works.
3. Loads the bundled `HELLO.TXT` resource, creates `C:\LIMTEST` with `INT 21h`, and writes the file with `_lcreat` and `_lwrite`.
4. Reads the copy back and compares checksums.
5. Writes an INI receipt with `WritePrivateProfileString` and reads it back.
6. Writes a log wherever a test harness might look for it.

![The Liminal Setup progress dialog in front of Program Manager on Windows for Workgroups 3.11, reading "Copying HELLO.TXT: 32%" above a text progress bar and a Cancel button](/blog/rust-on-windows-3-1/wfw311-copying.png)
*The modeless progress dialog. The bar is text: Windows 3.1 has no stock progress control, and the spike did not draw one.*

On Windows for Workgroups 3.11 and on Windows Me, the log ended the same way:

```text
checksum: source D5966D2E, copy D5966D2E
ini: ... match
RESULT: PASS
```

and `cmp` on the host found the installed copy identical to the original payload.

![The Liminal Setup wizard on Windows Me, on its last page: "Setup is complete. HELLO.TXT is in C:\LIMTEST and the receipt is C:\LIMTEST\INSTALL.INI. Click Finish", with Finish and Cancel buttons](/blog/rust-on-windows-3-1/me-wizard-finish.png)
*The same `SETUP.EXE` on Windows Me in VirtualBox, shown at twice its size. Windows Me reports itself to a Win16 program as version 3.95, and draws the 16-bit dialog in its own style.*

The sizes fit comfortably. `SETUP.EXE` uses about a tenth of its 64 KiB code segment, and its data, 8 KiB stack and 4 KiB heap together fill about 28% of the data segment. The packer refuses anything that does not fit, and cannot yet split code across segments.

| Program | File | Code | Data |
|---|---|---|---|
| `MSGBOX.EXE` | 620 B | 261 B | 44 B |
| `HELLO.EXE` | 3,440 B | 1,986 B | 464 B |
| `SETUP.EXE` | 14,944 B | 6,258 B | 4,624 B |

We rebuilt all three with the pinned Rust 1.98.0 while writing this post and got those exact byte counts back.

## How we ran it, and what we did not run

Windows for Workgroups 3.11 ran from a pre-installed tree in DOSBox-X 2025.02.01 with `WIN /3`. The harness set `run=D:\SETUP.EXE` in `WIN.INI` and pressed Return with `xdotool` under a virtual X server, since mouse clicks there were unreliable. Windows Me ran in VirtualBox from a floppy image made with `mtools`, and the result file came back off the floppy after power-off.

![A Wine window painted with "Rust, 16-bit code, one NE executable" and a dialog in front: "Welcome. This wizard is a native dialog resource driven by a three-page state machine written in Rust", with Next and Cancel buttons](/blog/rust-on-windows-3-1/wine-hello-wizard.png)
*`HELLO.EXE` on Wine 11.21, enlarged three times. The heading is the main window's `TextOut`; the box is the wizard dialog. Wine ran every page of it, and it is still the quickest way to try a change.*

The gaps matter as much as the passes:

- **No Standard mode and no 286.** We expect failure there but could not show it: Windows for Workgroups 3.11 refuses Standard mode, and we did not install a retail Windows 3.1. A 386 in Standard mode would execute the prefixes, so the honest floor is "a 386 or later", the same as Part 1's DOS floor.
- **No real hardware.** Everything ran in an emulator or a virtual machine.
- **No Program Manager group.** A Windows 3.1 installer is expected to make one, through a DDE conversation with `PROGMAN` (`[CreateGroup]`, `[AddItem]`). The spike did not attempt it, and packed no icon either.
- **No allocator and no `core::fmt`.** `alloc` builds but has no allocator behind it yet, and the log formats numbers by hand because `core::fmt` would cost tens of kilobytes.
- **One code segment.** 64 KiB of code is plenty for this proof, and not for everything.
- **One instance.** A second running copy was never tried.

![A DOS prompt in DOSBox-X: Windows for Workgroups 3.11 does not run in real or standard modes](/blog/rust-on-windows-3-1/wfw311-standard-mode.png)
*What happened when we asked Windows for Workgroups 3.11 for Standard mode with `WIN /S`. A real Standard-mode test needs a retail Windows 3.1 install.*

## The verdict

It works, with limits. Rust built for LLVM's `code16` mode, linked by `rust-lld` and rewrapped by our own packer, runs on Windows for Workgroups 3.11, Windows Me and Wine, shows native dialogs and installs a file correctly.

The limits are structural. It needs a 386 in Enhanced mode, so part of the Windows 3.x world is out of reach. The toolchain leans on an LLVM mode meant for bootloaders, an unstable Cargo flag, an overlay linker script and a packer we maintain. And every register rule had to be found on a running system, since the 16-bit convention predates the registers Rust keeps its values in.

The decision, D46 in the installer's `docs/decisions.md`, is to carry on with Rust for the `win16` runtime and keep Open Watcom C as the fallback. If a 286 in Standard mode ever matters, or the pinned toolchain costs more than it saves, the C path is still there. Until then, Win16 can share a language, and in time code, with the DOS runtime from Part 1.

## Try it

The spike is in the [liminal-hq-labs/liminal-installer](https://github.com/liminal-hq-labs/liminal-installer) repository, on the `feat/win16-spike` branch at the time of writing:

- `retro/win16/` holds the target spec, linker script, runtime, programs, packer, dumper and import generator. `bash retro/win16/build.sh` writes `MSGBOX.EXE`, `HELLO.EXE` and `SETUP.EXE`.
- `python3 -m unittest discover -s retro/win16/tests` runs the packer tests.
- `docs/win16-spike.md` is the full report, including the probe results and the harness setup, and `retro/win16/reference.sh` builds the Open Watcom message box for comparison.

You need `rustup` with `rust-src` and Python 3. Wine is the easiest way to run the results. You do not need a C compiler, unless you want the Open Watcom reference.

## Credits

**Wine** made this possible twice: its `.spec` files are where every ordinal and argument count in `imports.tbl` came from, and its Win16 support was the fast half of the test loop. **Open Watcom** was the reference we measured against, header by header. **DOSBox-X** ran Windows for Workgroups 3.11 faithfully enough to catch all six of those bugs. **LLVM**'s `code16` mode, built for bootloaders, turned out to stretch a long way past them.

## Next

[Part 3](/blog/rust-on-windows-9x) goes back up to 32 bits for Windows 95, 98 and Me, where Rust's own Windows target is close enough to be bent into shape.

All of this is heading somewhere. Quill is a small rich-text word processor for DOS, Windows 3.1 and Windows 9x, written in Rust from one shared core, and its Windows 3.1 build is meant to stand on this toolchain. It is still being planned, and a capstone post will cover it once there is something to show.
