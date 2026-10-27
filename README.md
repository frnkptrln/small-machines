# Small Machines

A growing world of original browser instruments, songs and encounters between machines.

SID makes a three-voice city. Paula brings samples and tracker patterns. Acid, drums and a warm polyphonic synthesizer join them in a shared performance rack. Each instrument can have its own music; they can also play together.

The repository gathers the studio, editable scores, rendering tools, production notes and video timing data. The original German song titles stay with the music.

## Play locally

Use Python 3 and a modern browser. From the repository root:

```sh
python3 serve.py
```

Open **http://127.0.0.1:8765/** and press the instrument's play button. On Windows, `py -3 serve.py` is an alternative. The server listens only on your computer. There is no application build or npm installation step.

| Instrument | Character | Page |
| --- | --- | --- |
| SID/65 | Three synthesized voices driven by a 6502 music routine | `index.html` |
| PAULA/68 | Four sample channels and a bounded 68000 music core | `paula.html` |
| ACID/16 | Monophonic bass, accents and slides | `acid.html` |
| DRUM/08 | Eight synthesized percussion voices | In `ensemble.html` |
| WARM/06 | Six voices, chords, PWM and stereo chorus | `warm.html` |
| ENSEMBLE/05 | All five instruments on one sample clock | `ensemble.html` |

The instruments work without the recorded albums. Listening-room recordings are separate media assets; see [recordings and archive downloads](archive/RELEASES.md) for their current availability. Open the instrument pages through the server rather than by double-clicking HTML files.

## Music and sources

| Collection | Besetzung / instruments | Sources |
| --- | --- | --- |
| SM001 · **Drei Stimmen, eine Stadt** | SID · eight tracks | [Album workshop](music/albums/SM001-003/) |
| SM002 · **Diskettenblumen** | Paula · eight tracks | [Album workshop](music/albums/SM001-003/) |
| SM003 · **Wo die Maschinen sich treffen** | SID + Paula · eight tracks | [Album workshop](music/albums/SM001-003/) |
| **Säureblumen** | Acid + Paula | [Composition](music/saeureblumen/) |
| **Licht im Hinterhof** | SID + Paula + Acid + Drums | [Set and reports](music/licht-im-hinterhof/) |
| **Bernsteinfenster** / **Besuch im Hinterhof** | WARM solo / all five instruments | [Scores, patches and reports](music/warm/) |

The [early pieces](music/early/) preserve the earlier solo and duo compositions. Their recordings and the later album recordings are distinct versions.

## Work on it

Node.js 24 or later runs the tests and offline renderers:

```sh
npm test
```

The suite covers the processors, synthesis, timing, project validation, recording and export. See [the production guide](docs/PRODUCTION.md) to turn a score into audio, and [the video handoff](video/) for score-derived cues.

- [Project direction and next chapters](docs/PROJECT.md)
- [Credits and collaboration](CREDITS.md)
- [Studio implementation and import history](docs/STUDIO-HISTORY.md)
- [Archive inventory and publication status](archive/RELEASES.md)

These are original, simplified instruments, not complete C64/Amiga emulators or licensed Roland products. Browser storage belongs to each origin: export your JSON projects before moving between hosted and local studios. Physical MIDI, iPhone behavior and sustained live performance still need testing on the target devices.

## License

The code — the instruments, the studio, the renderers, the tools and the tests — is released under the MIT License ([`LICENSE`](LICENSE)).

Everything else is released under CC BY-NC 4.0 ([`LICENSES/CC-BY-NC-4.0.txt`](LICENSES/CC-BY-NC-4.0.txt)): the music in whatever form it takes, the recordings, the album and video material, and the texts. The music includes the scripts that compose or encode a piece and the songs and patterns built into the instruments, for example everything in `music/`, `video/` and `dist/sets/`, as well as `dist/ensemble-score.mjs` and `tools/warm-score.mjs`. The MIT License does not cover the music, even where it is written as code. Credit it as Small Machines, with the title of the piece.

© 2026 Frank Peterlein (Small Machines)
