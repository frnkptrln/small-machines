# Historical studio notes

Snapshot of the previous hosted studio documentation (26 October 2026). Some historical download references describe the private archive at that time; use the current repository README and archive/RELEASES.md for this publication.

# SID/65 — a tiny machine for sound

A self-contained browser instrument built around an original instruction-level NMOS 6502 emulator and a simplified SID-register-compatible synthesizer. No dependencies, ROM images, copied music, analytics, or external assets.

## Play

Open the hosted application over HTTPS and press **Einschalten & spielen**. Audio starts only after a user gesture.

- Three monophonic voices; triangle, saw, pulse and noise; ADSR, ring modulation, oscillator sync.
- Three original musical presets and an empty pattern; 16 steps per voice.
- Click a step to insert the selected note; click the same note to erase it. Select a voice for the keyboard and transposition.
- The keyboard works with pointer/touch or A W S E D F T G Y H U J K. Z is an alias for Y on German keyboards. Space toggles transport when focus is outside controls.
- Filter, resonance and an optional tempo-synced echo.
- The Machine tab exposes live CPU/SID state, a small assembler, and instruction stepping.
- JSON projects save in localStorage and can be exported/imported. WAV renders four bars plus four seconds of tail at 44.1 kHz, mono 16-bit PCM. The last 200 ms fade out.
- PRG contains the loaded code and note/instrument tables with a two-byte load address. It has no BASIC loader. Invoke PLAY as a subroutine on a compatible system; scheduling and initialization are the caller's responsibility.

## Architecture

`app.mjs` → `worklet.mjs` → `Machine` → `CPU6502` → memory writes at `$D400–$D418` → `SID` → optional echo → Web Audio.

The UI writes note and instrument tables to emulated RAM. At each sixteenth-note boundary the host calls the assembled PLAY routine. That routine uses actual LDA/STA instructions to copy instrument settings and note data to SID registers and increment the step counter. The host calls short 6502 routines for gate-off, keyboard and live parameter changes too. Audio scheduling runs on the audio worklet thread; the CPU does not free-run at the SID clock frequency.

Memory map:

| Address | Purpose |
| --- | --- |
| `$0002` | Step index, wrapped by the supplied program |
| `$0100–$01FF` | CPU stack |
| `$0FFF` | Host subroutine return sentinel |
| `$1000…` | User program; default PLAY entry |
| `$1800…` | Host-generated immediate register-write routine |
| `$2000/$2010/$2020` | Voice 1 frequency low/high and gate tables |
| `$2040/$2050/$2060` | Voice 2 tables |
| `$2080/$2090/$20A0` | Voice 3 tables |
| `$3000–$3018` | Instrument register image |
| `$D400–$D418` | SID write-register model |

The assembler supports official opcodes and addressing modes, labels, numeric constants, `.org`, `.byte`, `.word`, and `<`/`>` low/high-byte expressions. It does not support macros, includes, or general arithmetic expressions. Forward labels use absolute addressing unless the short operand is already known. Routines must return with RTS within 4,096 instructions. Unsupported opcodes and runaway routines stop playback rather than blocking the audio thread. The host memory regions above are reserved; custom programs that overwrite them may break the instrument.

## Fidelity and limitations

- The CPU implements 151 official opcodes, addressing modes, stack, BRK/IRQ/NMI/RTI, binary and BCD arithmetic, page-cross cycle counts and the indirect-JMP page-wrap quirk.
- This is instruction-level emulation. No bus-cycle timing, dummy reads/writes, undocumented instructions, IRQ latency quirks or transistor simulation. Invalid BCD-digit behavior has not been validated against hardware. The full Klaus Dormann/SingleStepTests suites have not been run.
- The SID model uses a PAL-derived frequency conversion, three phase accumulators, a 23-bit noise LFSR, basic sync/ring behavior, and softened saw/pulse edges. ADSR uses simplified linear segments rather than the hardware's counters, exponential decay and ADSR delay bug. Combined waveforms are averaged. The filter is an approximate state-variable filter, not an analog 6581/8580 model. SID readback and bus-decay behavior are not emulated. Inspectors expose a software register shadow.
- The host triggers CPU routines per musical step, not through CIA interrupts. SID register writes within a routine take effect before the next audio sample, not at their actual emulated bus-cycle offsets.
- No VIC-II, CIA, 6510 I/O port/banking, BASIC/KERNAL ROM, disk drive, SID file player or Amiga emulation. This application is a new machine inspired by C64 sound hardware, not a complete C64.
- Echo and final soft clipping are additional effects, not SID features. Browser output gain is 0.75; WAV uses the same gain.
- Background playback and audio suspension depend on the browser. Download files are created locally; nothing is uploaded by the instrument.

## Development

The static site is in `dist/`. Serve it over HTTPS or localhost; AudioWorklet and module workers require a secure context. No build step is required.

Run `node --test tests/core.test.mjs` for CPU, assembler, sound, host integration and WAV tests.

Validation includes exhaustive binary ADC/SBC operands and carry inputs; all valid packed-BCD operand pairs; targeted stack, IRQ, branch/page crossing and wrapping behavior; opcode decoding; independent known assembler bytes; oscillator tuning; silent/non-silent presets; sample bounds and determinism; live changes; runnable-code dependency; worklet message handling; and WAV header, duration and signal checks. This is not full emulator conformance certification.

Interactive browser/audio-output QA was unavailable in the build environment. AudioWorklet and WAV worker logic were exercised with a Node harness. Mobile layout and audio autoplay handling are implemented but need real-device verification.

## References

- MOS/Synertek MCS6500 Programming Manual (1976), https://syncopate.us/books/Synertek6502ProgrammingManual.html
- Commodore MOS 6581 data sheet, http://archive.6502.org/datasheets/mos_6581_sid.pdf

## Files

- `cpu.mjs`: processor, opcode metadata and disassembler
- `assembler.mjs`: two-pass assembler
- `machine.mjs`: CPU/RAM/SID integration and original presets
- `worklet.mjs`: real-time audio thread
- `render-worker.mjs`: offline PCM/WAV rendering
- `app.mjs`, `index.html`, `style.css`: instrument interface

# PAULA/68 and Live Rack (version 2)

`paula.html` adds an Amiga-inspired sample studio and a shared SID/Paula performance rack. The original `index.html` instrument and its saved projects remain available. Navigation connects the two pages.

## New instrument

- Four signed 8-bit PCM channels, 512 KiB of virtual chip RAM, word-aligned sample pointers and word lengths.
- PAL audio clock (3,546,895 Hz), period-based playback and per-channel volume from 0 to 64. Periods are clamped to 124 or greater in this model.
- Left channels 0/3 and right channels 1/2, with adjustable stereo width.
- Thirty original synthesized samples in Drums, Bässe, Keys, Flächen and Effekte. The six original sounds are retained; Volume 01 adds 24 sounds including electric keys, plucks, mallets, an organ cycle, synthetic choir, bass cycles, drums and FX. No third-party recordings or ROM assets.
- Seven composed patterns and a blank pattern. Per-channel sample selection, looping, mute, gain and live triggering. New patterns: Velvet Circuit, Pocket Arcade, Amber Room, Wooden Satellites.
- Import short browser-decodable audio files, up to 2 seconds and 8 MB. Conversion stays in the browser: mono, 16 kHz, signed 8-bit, even byte length. Imported sounds play at their original rate on C4. Longer files are rejected explicitly rather than silently truncated.
- Export the selected sound as an uncompressed IFF 8SVX file.
- The 68000 assembler and execution monitor expose actual machine-code-driven Paula register writes.

## 68000 core scope

`m68k.mjs` is an original **bounded music execution core**, not a complete MC68000 implementation. Supported instruction families: MOVE/MOVEA (.B/.W/.L where valid), MOVEQ, LEA, ADDQ/SUBQ (Dn/An only), DBRA, BRA/BSR/BNE/BEQ, CLR, TST, JMP, JSR, RTS and NOP. Supported effective-address forms: Dn, An, (An), (An)+, -(An), d16(An), absolute short/long at execution level, immediate. The assembler emits absolute-long addresses. Not every family accepts every addressing mode.

Instructions use genuine 68000 encodings, big-endian storage, eight data/address registers, condition codes for implemented operations and a 32-bit subroutine stack. Address-error cases and unsupported opcodes stop execution. No complete instruction set, exceptions/interrupts, privilege model, precise timing, prefetch, bus arbitration, Kickstart, video chipset or MOD player. Routines must return with RTS within 4,096 instructions.

| Address | Purpose |
| --- | --- |
| `$1000…` | User 68000 PLAY routine |
| `$1800…` | Host immediate-write routines; reserved |
| `$2000–$2027` | Four 10-byte row parameter blocks: pointer.L, length.W, period.W, volume.W |
| `$2030/$2032` | DMA clear/set masks for the current row |
| `$FF00` | Initial stack pointer (stack grows down) |
| `$10000–$3FFFF` | Six original samples, original 32 KiB slot addresses preserved |
| `$40000–$5FFFF` | Four custom sample slots, each 32 KiB, original addresses preserved |
| `$60000–$7FFFF` | 24 expansion samples packed on even boundaries (129,516 bytes) |
| `$DFF096` | DMACON set/clear model |
| `$DFF0A0–$DFF0D8` | Four Paula pointer/length/period/volume register groups |

The scheduler prepares row data and invokes the 68000 routine. MOVE instructions copy those parameters to Paula registers; changing the routine changes the sound. Manual triggers and live volume changes use generated 68000 instructions too. DMA is modelled at sample level, not as Amiga video-bus slots. One-shot termination and whole-sample looping are host instrument policies. Hardware reload timing, direct AUDxDAT playback, modulation, interrupts and exact analog filtering are not implemented. The low-pass, DC removal, width, delay and output soft clipping are modern approximations/effects.

## Performance rack

Open `paula.html#live`. The two machines share one sample-clock scheduler; SID does not run a second independent tempo loop. The crossfader uses equal-power curves with smoothed gains and exact endpoint isolation. BLEND hears both machines; the initial studio mix is Paula-only.

- Four scene slots contain both machines, sample data, source programs and mixer settings. Three example scenes and one empty slot are provided. A separate Save button overwrites a slot; Start queues it for the next bar. Live scene changes retain the current master tempo and use a 12 ms output crossfade. Scene engine allocation happens when the message is received rather than at the bar-boundary switch.
- Master volume, shared tone filter, individual channel mutes, tap tempo, panic and a larger stage view. Fullscreen is used only when the browser permits it.
- Web MIDI is requested only via its button, without SysEx. Incoming notes play the selected Paula channel; CC 1 controls the crossfader; all-notes-off/all-sound-off release held notes. No MIDI clock synchronization or device-specific mapping. Availability depends on the browser.
- REC captures the actual worklet stereo output, including scene changes and parameter moves, into ordered Float32 chunks, then encodes PCM WAV. Recording stops automatically after 120 seconds. A stopped transport may still be recorded for release tails. Panic also finishes a running take.
- Offline WAV export renders four bars plus four seconds of tail through the same rack and adds a final 200 ms fade.
- Session and scenes autosave to IndexedDB when available; portable JSON includes custom sample data. The original SID studio keeps its original localStorage key. “Muster aus SID-Studio übernehmen” reads that saved project explicitly.

Module-worker rendering, AudioWorklet, pointer input, IndexedDB, optional fullscreen and optional Web MIDI are used. No server runtime or backend data store is required. Imported samples and recording audio are not uploaded.

## Homepage integration

The static files are relocatable and use relative asset paths. They can be hosted under a path such as `/small-machines/` on a future homepage without application dependencies. `paula.html?embed=1#live` uses a compact embedding layout; an iframe needs `allow="autoplay; midi; fullscreen"` and an appropriately sized viewport. Cross-origin iframe use and MIDI permission policy have not been browser-tested. The present hosted Site remains owner-private; embedding that private URL does not grant visitors access. The homepage and audience have not been changed.

## Additional validation

Run `node --test tests/core.test.mjs tests/paula.test.mjs tests/sound-bank.test.mjs`.

40 test groups currently cover the two machines and the expanded sound bank. Added tests check independent known 68000 opcode words, endian order, data widths, MOVEA sign extension, DBRA bases and register preservation, JSR/BSR/RTS stacks, arithmetic flags, invalid programs, signed PCM, Paula stereo assignment, DMA masks, sample lengths, sample pointers, tuning periods, one-shot/loop behavior, source-code control of sound, all presets, scene boundaries, shared-clock synchronization, crossfader endpoints, master mute, panic, project validation and custom-sample round trips, IFF 8SVX, stereo WAV, recording limits and exact equality of live recording chunks with produced worklet output during a fader change.

No direct interactive browser, physical MIDI, audio-device latency or stage reliability test was possible in this environment. The worklet is tested through a Node harness. Real-device testing remains necessary before a performance. This is an instrument prototype, not emulator conformance certification.

References: Commodore's Amiga Hardware Reference Manual, audio chapter (https://www.amigarealm.com/computing/knowledge/hardref/ch5.htm), and Motorola M68000 Family Programmer's Reference Manual (https://www.nxp.com/docs/en/reference-manual/M68000PRM.pdf).


## Sound Library / Volume 01

The Paula studio has a searchable library with category filters and a target-channel selector. Loading a sound retains notes, volume, mute and program; it applies the sound's recommended whole-sample loop setting and selects its root octave on the keyboard. Per-channel menus also group sounds by category. Imported sounds appear under Eigene.

Audition is isolated from the set: a short Web Audio buffer plays at the sample's stored root rate (up to two seconds; cycles repeat for 0.9 seconds). This is a direct PCM preview, not a preview through Paula's register divider, mixer and effects. Audition is available only with transport and recording stopped, and is stopped by play, recording, manual notes, scene launch, panic, tab change, closing the library or hiding the page. Audition is never included in recordings.

The original SID studio has 16 voice patches: four basses, four leads, three keys, two pads, two percussion sounds and a noise swell. Each voice has a grouped Instrument selector. Patches change waveform, pulse width, ADSR, ring and sync only; they preserve mute, notes, shared filter, tempo and source. Manual changes are reflected as Eigener Klang. Projects retain normal numeric voice parameters, so no save-format migration is required. SID patches enter the live rack through the existing explicit “Muster aus SID-Studio übernehmen” action.

Bank checks cover unique and reproducible sample data, overlap-free chip RAM with maximum-length custom sounds, unchanged legacy/custom addresses, all-sound playback through the CPU/Paula path, 8SVX payloads, assignment/JSON round trips, search, audition bounds/fades and all SID patches. Existing CPU, preset, shared clock, scene, recording and export checks remain. Browser/audio-device audition and visual layout QA have not been run in this environment; actual-device testing is still needed for live performance.


## ACID/16 — experiment 003

`acid.html` is the third standalone instrument. Its original monophonic synthesizer is inspired by classic acid-bass playing techniques, not a transistor-level or circuit-accurate Roland emulation. No Roland ROMs, samples, branding assets or external audio dependencies are included.

- PolyBLEP saw/square oscillator, two-times oversampled cascaded TPT low-pass filters, nonlinear saturation, DC removal, smoothed filter/pitch/output parameters and separate gate/filter envelopes.
- A sixteen-step, sample-clock sequencer. Accent increases amplitude and filter movement; an outgoing Slide connects to the next non-rest note without retriggering envelopes. A rest breaks a slide. Four original presets plus a blank pattern, transpose and gate length.
- Fixed stereo echo taps avoid delay pitch jumps during tempo changes. Stop releases the gate; Panic resets the voice and delay. The original two-deck SID/Paula rack remains accessible through navigation.
- REC captures actual stereo worklet output, including parameter moves, for up to 120 seconds. Eight-bar offline WAV export uses the same engine and adds a two-second tail with a final fade. Export runs in a module worker.
- The current pattern saves under its own localStorage key. JSON import validates version, pattern, controls and note range; import size is limited to 100 KB. No uploads or backend storage.

Run `node --test tests/*.test.mjs`. ACID checks cover tuning at 8/44.1/48 kHz, glide/retrigger behavior, accent/filter energy, transport drift over 32 bars, finite unclipped output across presets and extreme controls, release/panic, exact recording chunks including a live filter move, the recording limit, WAV duration and PCM, validation, and page wiring. Browser rendering, actual audio-device playback, mobile download behavior and stage reliability have not been verified here.

Control reference: Roland TB-03 Owner's Manual, https://static.roland.com/assets/media/pdf/TB-03_eng03_W.pdf. The DSP is an original approximation rather than an implementation of the manufacturer circuit.


## ENSEMBLE/04 + DRUM/08 — experiment 004

Open `ensemble.html` for the four-machine live rack and its first session, **Licht im Hinterhof**. The SID, Paula and Acid studios and the older two-machine rack remain available through navigation.

- DRUM/08 is an original eight-voice percussion synthesizer inspired by 808-style drum-machine playing: kick, snare, clap, closed/open hats, tom, rim and cowbell. Each voice has level, tune, decay and mute. Closed hats choke open hats. It is not a circuit-accurate Roland emulation and uses no manufacturer samples.
- One sample clock drives all four machines. Eight scene slots hold patches and eight-bar phrases. Manual changes launch at the next bar; automatic mode follows scene lengths. Global faders, mute, solo and Acid filter remain under live control.
- The factory set has 480 bars at 128 BPM: 15 minutes of music, followed by four seconds of tail in the recording. Eight-bar harmonic phrases, changing instrumentation, fills and scene envelopes give the set its form.
- Paula uses linear PCM interpolation and 3 ms transitions in this rack to soften retrigger/one-shot discontinuities. The standalone Paula engine remains unchanged. These are playback refinements, not claims of full hardware emulation or a fix for every possible imported sample.
- Drum pads, an eight-bar / sixteen-step editor, groove starters, scene naming/length, JSON import/export, local autosave and stage view are included. Keyboard 1–8 queues scenes; Space controls playback; Escape is Panic when focus is outside text controls (Escape always remains Panic).
- REC captures actual stereo worklet output, including live controls, as 16-bit WAV for up to 20 minutes. Automatic set end adds four seconds of tail. Offline export renders eight bars or the whole set in a module worker. Long recordings/exports need substantial browser memory and are not real-device performance certified.
- SID, Paula, Acid and DRUM/08 JSON files can supply a deck's sound and pattern to the selected scene. Imported patterns repeat over its eight bars. SID/68000 host note routines execute genuine instructions, but the ensemble uses its own scheduler rather than the imported project's custom PLAY loop.
- The Hörzimmer contains a mastered AAC/M4A recording. It uses a fixed gain and a final fade, preserving the set's dynamics; the editable rack has its own mixer. The recording and all composition data are original.

| Start | Scene | Bars |
| --- | --- | --- |
| 00:00 | Die ersten Fenster | 32 |
| 01:00 | Diskettengarten | 64 |
| 03:00 | Kupferregen | 64 |
| 05:00 | Säureblumen bei Nacht | 64 |
| 07:00 | Der stille Innenhof | 64 |
| 09:00 | Laternenfieber | 64 |
| 11:00 | Alle Fenster offen | 64 |
| 13:00 | Morgen auf dem Balkon | 64 |

### Reproduce and verify

Run `node --test tests/*.test.mjs`: 58 test groups pass. The ensemble additions cover independent clock scheduling and bar-quantized transitions, fractional tempo, deterministic percussion/choke, all scenes, panic and exact mute, JSON validation/edits, actual worklet recording bytes during mix/scene changes, the recording cap and offline WAV duration/tails.

`node tools/render-ensemble.mjs /absolute/output` streams the full factory set and writes its JSON and measured render report. `python3 tools/master-ensemble.py /absolute/output` creates WAV/MP3/M4A with ffmpeg and verifies PCM bounds, duration and MP3 true peak. No machine or player software is needed to listen to the exported files.

The managed browser preview verified desktop and 390 px iframe rendering, scene selection, stage controls, persisted drum edits and the eight-bar worker export. The preview's HTTP context cannot start AudioWorklet; real audio-device playback, iPhone behavior and sustained live-stage reliability still need device testing. The published page must be served over HTTPS.

New modules: `drum.mjs`, `ensemble-score.mjs`, `paula-smooth.mjs`, `ensemble.mjs`, `ensemble-worklet.mjs`, `ensemble-render-worker.mjs`, and `ensemble-app.mjs`. The serializable `small-ensemble` v1 schema stores all eight scenes, four deck states and eight bars per scene; projects are kept under a separate localStorage key.


## WARM/06 + ENSEMBLE/05 — experiment 005

`warm.html` adds an original six-voice polyphonic instrument inspired by the Roland Juno family. Saw, PWM pulse, sub oscillator and noise feed an ADSR envelope, approximate resonant low-pass/high-pass filtering, slow drift and a stereo chorus. This is original DSP, not a circuit-accurate emulator or a licensed Roland product. No manufacturer recordings or ROMs are used.

Six original presets cover pads, bass, plucks and slowly moving textures. The page includes 18 controls, a two-octave pointer/keyboard piano, eight bars of chord events, local save, project import/export, five-minute live recording and eight-bar worker WAV export. Manual voices are released on blur; pattern edits stop the transport, while sound controls remain live. A metadata-only rename does not reload audio.

`small-machines-warm` v1 projects hold name, BPM, parameters and eight arrays of sixteen events. An event is null (no new trigger) or `{notes:[MIDI24..96], velocity:0..1, length:1..32}` with up to six distinct notes. Length is in sixteenth notes and may be fractional. Each voice owns its gate lifetime, including after reuse/stealing.

ENSEMBLE/05 adds WARM as a fifth deck on the existing sample clock. The explicit studio-transfer button passes the patch and all eight pattern bars to the selected scene. Existing `small-ensemble` v1 files load through a non-mutating v2 migration with an empty fifth part. The existing localStorage key is read as a fallback; new saves use a v2 key. New factory sets include WARM chords, while the original quartet score and recording remain available. V2 validates both the WARM project and its scene event matrix.

### New recordings and archive

- **Bernsteinfenster:** 80 bars at 96 BPM, 3:20 music plus five seconds of tail. Six sections with an opening, theme, development, quiet bridge, varied return and coda. WARM/06 solo.
- **Bernsteinfenster · Besuch im Hinterhof:** 48 bars at 112 BPM, approximately 1:47 including tail. All five engines share the clock.

`node tools/render-warm-session.mjs /absolute/output both` streams both original performances as Float32 WAV and saves measured render reports, the full composition, a playable WARM excerpt and the five-machine set. `python3 tools/master-warm-session.py /absolute/output` creates PCM16 WAV, MP3 and AAC/M4A. Masters use a 24 Hz high-pass, fixed gain and ending fade rather than dynamic loudness compression. Final MP3s measured approximately -18.2 LUFS with true peaks -4.7 and -2.7 dBFS; no PCM clipping.

`archive.html` is the studio's release catalogue. The two-part persistent **Small-Machines-Archiv.zip** plus **Small-Machines-Archiv-Originalausgaben.zip**, extracted into the same folder, gather 22 existing releases plus the new WARM recordings, scores, six patch files and reports. Its offline START-HIER.html is the entry point; KATALOG.json retains provenance and SHA256. Historical packages remain byte-identical. Instrument source stays canonical in this Site repository. Future archive updates should replace the same Library file identities, preserving the central filename and version history. Soundblaster and the proposed videos are not yet included.

### Verification

Run `node --test tests/*.test.mjs`: **71 groups pass**. New tests cover tuning at three sample rates, six-voice allocation and gate ownership, deterministic/stereo/finite output, fractional transport, actual recording bytes and the full five-minute recording limit, worker export, strict v2 validation, shared five-deck scheduling, transfer, solo/mute and panic. Three original quartet scenes match independent PCM16 hashes captured from the previous published commit.

Browser QA verified WARM preset/editor persistence, input rejection, WAV export and transfer; Ensemble's fifth deck, eight-bar export and stage layout; desktop and 390 px layout; and both new native-media players with expected durations. The HTTP preview cannot start AudioWorklet. Sustained live output and iPhone behavior still require target-device testing. The hosted application uses HTTPS.

Primary design references: https://www.roland.com/us/products/rc_juno-60/ and https://cdn.roland.com/assets/media/pdf/JUNO-60_OM.pdf. These inform the broad oscillator/filter/chorus direction; the implementation is an original approximation.

## Portable studio and video handoff — archive edition 02

`dist/downloads/Small-Machines-Studio-und-Partituren-2026-10-24.zip` is a third archive part. Extract it alongside the two music ZIPs into the same parent directory. It adds `Small-Machines-Archiv/06-Studio` and `07-Video-Uebergabe`; its root manifest identifies every file with SHA256. Source remains versioned in this Site repository; this source supplement is hosted here rather than duplicated in Library.

The portable studio pins 58 original source files to commit `4cf5a47e58eee238f1fde0e68c38a178092c683f`. Its Python standard-library starter serves only on localhost and maps the three Hörzimmer media paths to the MP3s already in the archive, with the correct MIME type, download name and byte-range handling. Instrument HTML/JS remains byte-identical. There are no credentials, browser settings or Git metadata in the export. Missing music affects only recorded playback; the synthesized instruments still work. Local browser storage is separate from the hosted studio, so users must export/import their own projects explicitly.

The video handoff includes all 24 original SM001–003 scores, the album sources and exact PCM track offsets, plus the original Licht im Hinterhof set. Its JSON/CSV cues describe note/gate/filter/scene commands at 44.1 kHz; they are not measurements of loudness, spectra or acoustic note endings. The album swing and event-ID gate rules follow the original renderer. Licht cues call the genuine Ensemble tick method, preserve sample timing and evolving patterns, and retain the original four-machine arrangement. MP3 decoder delay/padding is documented separately from musical time. No videos have been generated or sent to Claude.

`tools/build-studio-archive.py` makes the pinned studio ZIP. `tools/combine-archive-supplement.py` combines that reviewed ZIP with the video handoff ZIP. The latter contains `generate-cues.mjs`, `verify-cues.mjs`, original inputs, German instructions and manifests. Generators default to the sibling exported studio. The two original music parts retain their existing Library identities; edition 02 adds project and production documentation to the main music ZIP.

Validation: 58 exported source hashes and six historical album engine hashes match; local HTTP pages, JS modules, JSON and all three audio routes pass MIME/HEAD/range checks. All 24 score event counts, rendered lengths and album offsets match their original reports. Licht has 7,680 ticks and eight original scene boundaries; three rendered two-bar excerpts match 331 commands, and an independent 61-second scheduler check including a scene change matches 2,116 commands. ZIP CRCs and file manifests pass. No DSP code changed in this update, so the previously passing 71 instrument test groups were not rerun. Real-device audio, MIDI, iPhone and stage endurance still require device testing.
