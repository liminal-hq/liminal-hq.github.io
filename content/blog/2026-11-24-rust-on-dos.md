---
title: "Cross-compiling to the past, part 1: Rust on DOS"
date: "2026-11-24"
slug: "rust-on-dos"
excerpt: "A custom i486 target got Rust as far as machine code. A DOS loader and a low-memory buffer took it the rest of the way, from printing a string to running an installer."
tags:
  - "Cross-compilation"
  - "Rust"
  - "DOS"
  - "Desk"
  - "Liminal Installer"
draft: true
---

One night I was playing with an idea for Lieutenant Fizz, a retro platform game I’d already made for the web. Episode 1 had sprites, a pogo stick, a Fizz stunner and a Rust simulation running in the browser through WebAssembly. Could the whole thing fit on a 1.44 MB floppy? I wanted someone to type `FIZZ.EXE` at a DOS prompt and play a level with the same keys I remembered using in Commander Keen.

The first thing that got me excited was a line of text.

```text
start
Hello from Rust in DOSBox
rust_hello returned 3.250000
```

There were two languages speaking in that little transcript. A C program printed the first line and called a Rust function. Rust asked the C library to print the greeting, calculated `2.0 * 1.5 + 0.25`, and returned the result. C printed the number. In three lines I could see that DOS had loaded the executable, that control had made it into Rust, and that even a floating-point result had made it back across the boundary. That was enough to try the game.

## What went into FIZZ.EXE?

The browser version already had a useful division of labour. Rust decided where the player was, whether a tile stopped him and what happened when a shot hit an enemy. The browser took input and put the result on screen. To try DOS, I needed a new build of that Rust code for an x86 processor and a new front end that knew its way around a PC.

Here are four fields from the custom target used for the first greeting. The curious one is the first.

```json
{
  "llvm-target": "i486-pc-windows-gnu",
  "cpu": "i486",
  "binary-format": "coff",
  "target-pointer-width": 32
}
```

Why does a DOS game say *Windows*? At this stage I wanted LLVM, Rust’s code generator, to produce 486 instructions in COFF object files. An object file is a piece of a program with some addresses still to fill in. Choosing how to write that piece and choosing who will load the finished executable are separate decisions. There are no calls to Windows in the greeting.

The Rust library used `#![no_std]`. On a custom target, Cargo’s `build-std` setting rebuilt `core`, `alloc` and the compiler support routines for that target. The build then fed the resulting archive through a small Python converter. LLVM and DJGPP, the GNU toolchain for DOS, used different conventions for recording relative addresses in COFF. The converter adjusted those references and grouped the sections into code, initialized data and space for zero-initialized data. DJGPP could then link the archive with the C entry point. [The greeting, target file and build script](https://github.com/ScottMorris/lieutenant-fizz-dos/tree/bb220bd/m1)

At the prompt, DOS sees the MZ header at the front of the finished executable and starts a small loader. The loader’s job is to get the 32-bit program into memory and hand it control. DOS starts programs in real mode, where addresses use a segment and an offset. The game wants protected mode, where it can work with 32-bit pointers and extended memory. CWSDPMI provides the DOS Protected Mode Interface (DPMI) that makes that arrangement possible. The C side gave Episode 1 an allocator, access to DOS and a place to put the hardware drivers. The floppy would carry native x86 machine code. WebAssembly was how the browser ran its own build of the same rules.

## Could I play the same level before I could see it?

I already had a way to ask the web simulation what happened when a player pressed a particular sequence of keys. Give the DOS build that sequence, advance one tick at a time and check what each simulation reports. A short fingerprint, or hash, of 26 selected state values makes it practical to compare thousands of ticks without inspecting thousands of positions by hand.

The first disagreement appeared at tick 120 of the first test level. The web simulation used 64-bit floating-point numbers, with 53 bits of precision for the significant digits. On DOS, the x87 floating-point unit could keep extra precision in its registers. A later calculation could see digits the web version had already rounded away. Giving both builds the same source code still left that choice up to the machine.

The DOS port set the x87 precision control to 53 bits before the first tick and used the Rust `libm` routines for the maths functions. The replay covered 16 levels, 3,000 ticks apiece, with a comparison every 60 ticks. All 800 checkpoints matched. At that point I had evidence that Ben was moving through the same game world, even though the DOS build had yet to draw him. [How the replay comparison works](https://github.com/ScottMorris/lieutenant-fizz-dos/blob/main/docs/ARCHITECTURE.md)

## What does the pogo key look like from inside the game?

In the browser, a key press arrives as a DOM event. On the DOS PC, the keyboard raises interrupt request 1, or IRQ 1. The interrupt handler reads a scan code identifying the physical key and records which keys are down. It also remembers a fresh press until the game has had a chance to see it. Otherwise a quick tap and release between two 60 Hz simulation ticks could vanish entirely.

By the time the simulation takes its next step, either route can tell it that the player pressed Pogo. The rules decide how Ben moves. Downstream, the DOS front end draws his sprite into a 320 × 200 image using the 256 colours of VGA mode 13h and copies the result to video memory. This is the part I wanted to *feel*. By the end of that first night I could play a level with the same keys and sprites I knew from the web version, bounce up for a snack and fire the stunner to slip past an enemy.

![Ben jumping in Crater Fields, with a snack above the gap and an enemy on the far side](/blog/rust-on-dos/fizz1-crater-fields.png)
*Crater Fields in the DOS port of Episode 1. [Screenshot from the game repository](https://github.com/ScottMorris/lieutenant-fizz-dos/blob/d7a5e4e702bef6eb277b41d03b03f4a01bff4b7b/site/img/level0.png)*

Sound crosses the same boundary in the other direction. In the browser, code can hand a sound cue to an audio library. The DOS driver has a programmable timer and an AdLib-compatible OPL2 synthesizer to work with. The timer fires 560 times a second. Its interrupt handler advances the music, sending register values to the chip when a note or an instrument setting is due. An effect can use a spare channel while the level music keeps playing. On a machine without AdLib, the driver can play effects through the PC speaker. A reader could replace that whole sound system and Ben would still know when he had fired a shot. [Keyboard, video and sound in the DOS port](https://github.com/ScottMorris/lieutenant-fizz-dos/blob/main/docs/DOS_ARCHITECTURE.md)

## What could we bring into Rust next?

Episode 1 answered the floppy question. The release process builds a 1.44 MB disk image, and the game plays from its opening through the ending in DOSBox. A run on a physical machine from the 1990s is still on my wish list. [Episode 1 for DOS and its floppy images](https://github.com/ScottMorris/lieutenant-fizz-dos)

Getting there made me curious about the C layer. Which parts did the PC actually require, and which parts were there because DJGPP had been a convenient way in? Desk explored that question from two sides. Its DOS-hosted graphical shell uses a fresh Rust runtime. Its native experiment boots a Rust kernel, giving it a place to explore what happens when you supply the operating system yourself. [Desk’s hosted and native designs](https://github.com/liminal-hq/desk)

For the hosted route, Desk’s target says `i486-unknown-none-elf`. This time Rust’s own linker, `rust-lld`, resolves the addresses and produces an ELF executable. A Python packer reads the linked sections and wraps them in the go32 layout the DOS loader expects. That explains why you’ll find both ELF and COFF in accounts of Rust on DOS. In Episode 1, COFF objects went *into* DJGPP’s linker. In Desk, ELF comes *out of* Rust’s linker, and the packer prepares that finished program for the loader. DPMI still supplies protected-mode services. More of the code on our side of that boundary now belongs to the project.

Lieutenant Fizz 2 could start with the question Episode 1 had helped me discover. What if I designed the game this way from the beginning? Its fixed-tick engine takes input and advances the world. Front ends with different keyboards, graphics and sound can express that world in their own ways, while a recorded replay gives native, web and DOS builds something exact to agree on.

![Lieutenant Fizz 2 running a scripted replay in DOSBox, with Ben on a wooden walkway beside brick towers](/blog/rust-on-dos/fizz2-dos-replay.png)
*Episode 2 running its own replay. The DOS renderer draws the scene while the simulation produces a state the other builds can check.*

Once there was a game someone could take home, I wanted an installer. Its DOS front end could read the keyboard and draw a text screen, while its Rust engine decided what files belonged where. That left an intriguing possibility for [Windows 3.1](/blog/rust-on-windows-3-1). Could I keep those decisions and let Windows draw the Next button?
