# From a pattern to a recording

A composition is stored as notes, patterns, patches, tempo and sections. The instrument engine turns these instructions into sound; the sequencer places them on an audio sample clock. Rendering and mastering are separate steps. Retain both the data and the exact engine revision used for a release.

## Requirements

- Playing the studio: Python 3 and a modern browser with Web Audio.
- Tests and offline rendering: Node.js 24 or later.
- Session mastering: Python 3, `ffmpeg` and `ffprobe` on the executable path.
- Album mastering: the above plus Python `numpy` and `scipy`.

There are no JavaScript package dependencies to install for the studio. A full album rebuild needs several GB of working space. The commands below use a POSIX shell; adapt paths and the Python command for Windows.

## Licht im Hinterhof

From the repository root:

```sh
node tools/render-ensemble.mjs "$PWD/rendered/licht"
python3 tools/master-ensemble.py "$PWD/rendered/licht"
```

This renders the original quartet: 480 bars at 128 BPM, 900 seconds of music and four seconds of tail. The score is in `dist/ensemble-score.mjs`, the shared sequencer in `dist/ensemble.mjs`, and the archived editable set and reports in `music/licht-im-hinterhof/`. WARM stays silent in this version.

## Bernsteinfenster and Besuch im Hinterhof

```sh
node tools/render-warm-session.mjs "$PWD/rendered/warm" both
python3 tools/master-warm-session.py "$PWD/rendered/warm"
```

The solo is 80 bars at 96 BPM: 200 seconds of music plus five seconds of tail. The visit is 48 bars at 112 BPM, approximately 106.857 seconds including tail. `tools/warm-score.mjs` contains the compositions; `music/warm/` preserves the released scores, importable projects, patches and reports.

The session tools stream Float32 stereo WAV at 44.1 kHz. Mastering uses a 24 Hz high-pass, fixed gain and an ending fade, then creates and checks the output formats. The reports distinguish measured peaks and loudness from listening judgments.

## SM001–003 album workshop

The workshop contains all 24 complete JSON scores. To render and master just **Diskettenblumen**, start at the repository root:

```sh
export SMALL_MACHINES_ENGINE="$PWD/dist"
cd music/albums/SM001-003
python3 source/build-albums.py PAULA-02
```

The environment variable must be an absolute path. `build-albums.py` invokes the renderer and mastering script in order. Use `SID`, `PAULA` or `DUO` to select an album, or omit the argument for all 24 tracks. Outputs go into the workshop's working/output directories as defined by its scripts.

The complete original build sequence is:

```sh
node source/compose-albums.mjs
node source/check-recording.mjs
python3 source/build-albums.py
python3 source/package-albums.py
```

`compose-albums.mjs` rewrites the 17 newer compositions; the seven earlier scores are already present. Skip regeneration if you want to keep your edited scores. The workshop's README, `engine-version.json`, catalogue and per-track reports explain the original production. The six recorded engine hashes match the imported studio source.

The album renderer preserves its own swing formula, gate handling and Paula smoothing. Do not substitute the current browser preset for the full recorded arrangement. The earlier recordings under `music/early/` remain separate historical versions.

## Säureblumen

`music/saeureblumen/` contains the full Acid/Paula composition, its renderer and a shorter importable Acid pattern. Follow that workshop's included instructions; the pattern alone is not the complete piece.

## Video timing

The [video handoff](../video/) contains original scores and the cue generator for the three albums and Licht im Hinterhof. The full JSON/CSV event lists are generated output; precomputed download availability is recorded in the archive documentation. To generate them with this repository's engine:

```sh
node video/generate-cues.mjs --engine-dir "$PWD/dist"
```

Run that command from the repository root. Frames in the cue files are **audio sampleframes at 44,100 Hz**, not video frames. Album offsets come from the original concatenated PCM lengths. Do not add rounded MP3 durations to derive them.

Use the audio player's time as the video clock. Reset cue lookup after seeking. MP3 encoders and decoders can introduce delay or padding; verify the decoded start before applying a constant offset. A gate release or filter target describes a control instruction, not the measured loudness or the moment all sound stops. The video handoff documents these distinctions.

## Versions and validation

Save the score, patches, source revision, encoder settings, render report and checksums with each finished recording. Matching source and musical instructions makes the process inspectable; bit-identical MP3/AAC files also depend on the encoder version and metadata.

`npm test` runs the instrument suite. Before release, check durations, finite samples, peak levels, endings and the intended instrumental lineup, then listen on the target playback system. Whole-album WAV/FLAC masters and exported music videos are not part of the recovered archive; retain them when they become available.

