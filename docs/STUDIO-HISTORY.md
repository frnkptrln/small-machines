# Studio source history

This repository imports the working Small Machines studio from the independently
versioned Site source at commit `c271a4aa912a1efd70c9f9cf83d3c64f89c70180`
(26 October 2026 import). The hosted Site remains a separate deployment; this
repository does not contain its hosting identity or credentials.

The original source evolved through these instrument chapters:

| Chapter | Instrument | Scope |
| --- | --- | --- |
| 001 | SID/65 | Instruction-level 6502 core and a simplified three-voice SID-style instrument |
| 002 | PAULA/68 | Bounded 68000 music core, four sample channels and a shared SID/Paula rack |
| 003 | ACID/16 | Original monophonic acid-style synthesizer and sequencer |
| 004 | DRUM/08 + ENSEMBLE/04 | Original eight-voice drum synthesizer and the four-machine shared-clock set |
| 005 | WARM/06 + ENSEMBLE/05 | Original six-voice polysynth and a fifth ensemble deck |

These are original, intentionally simplified instruments. They are not complete
C64/Amiga emulators, circuit-accurate Roland emulations or manufacturer products.
The built-in sample bank is synthesized; no manufacturer ROM or recording is
needed to play the instruments.

## Import boundaries

All 31 top-level `dist/*.mjs` modules, seven original test files, instrument
styles/pages, factory JSON projects and seven historical tools were copied
without changing their bytes. The only edited original studio file is
`dist/archive.html`: its references to private archive downloads now lead to the
public repository and its archive documentation. The three original M4A listening
recordings are separate assets, excluded from Git by `.gitignore`.

New repository conveniences are `serve.py`, `package.json`, `.gitignore`, the
minimal test workflow, and documentation. The server uses Python's standard
library, binds only to `127.0.0.1` and serves `dist/` with JavaScript module MIME
types. No npm dependency installation or build step is required. Optional media
files can be restored to `dist/audio/`; the synthesized instruments do not depend
on those files.

Local browser storage belongs to the local address. It does not automatically
copy saved projects, imported samples or live takes from the hosted Site. Use
each instrument's JSON/audio export and import controls for those personal files.

## Scores and reproducibility

The original SM001–003 album workshop records engine commit
`1ec90acd0afdf02d58260ef9ff5c5ea02993b5d7`. Its six engine modules remain byte-equal
in this import: `machine.mjs`, `cpu.mjs`, `assembler.mjs`, `paula.mjs`,
`m68k.mjs` and `sound-bank.mjs`. The workshop's own `engine-version.json` contains
their SHA256 values.

The archive's portable studio snapshot pins the instrument state to
`4cf5a47e58eee238f1fde0e68c38a178092c683f`; the later source commit adds the archive
download and packaging documentation. Musical sources and master reports remain
separate from the finished listening files. Matching notes and engine code alone
does not promise byte-identical MP3/AAC output across encoder versions.

`tools/render-ensemble.mjs` renders the original **Licht im Hinterhof** quartet,
not the newer five-deck factory arrangement: 480 bars at 128 BPM, 900 seconds of
music and four seconds of tail. `tools/render-warm-session.mjs` renders the two
WARM sessions. Their Python mastering scripts require `ffmpeg` and `ffprobe` in
PATH; the original album workshop also uses NumPy/SciPy.

## Historical archive builders

`tools/build-studio-archive.py` and `tools/combine-archive-supplement.py` preserve
how the 24 October archive supplement was assembled. The studio builder reads
specific commits from the original Site Git history. That history is **not**
embedded in this newly initialized GitHub repository, so a fresh clone cannot run
that historical builder on its own. It is not part of the normal start, test or
music-render path. The combiner accepts previously built studio/video ZIPs and
validates every member before creating a combined package.

## Verification at import

The copied source passed all **71 instrument test groups** under Node.js 24.
The checks cover CPU behavior, validation, sequencing, shared-clock integration,
recording/export and the WARM additions. Runtime module and test-file hashes
match the source. Local HTTP checks cover instrument pages, module/worklet/worker
MIME types and factory JSON files; local relative asset/module references were
checked as well.

No new subjective listening test, physical MIDI test, iPhone test or sustained
stage-performance test was performed for this import. Those remain real-device
validation tasks before a performance or mobile release.
