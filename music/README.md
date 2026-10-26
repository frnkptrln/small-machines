# Music sources

The composition data, rendering/mastering programs, patches, artwork and measured reports accompany the studio source. Musical score data and executable sources are preserved byte-for-byte; documentation links and dependent checksum manifests are sanitized for public distribution. Binary recordings live in the separately prepared archive assets described in [../archive/RELEASES.md](../archive/RELEASES.md).

| Directory | Contents |
| --- | --- |
| `albums/SM001-003` | 24 full SID, Paula and duet scores; shared composer, renderer and mastering; reports and album catalogue |
| `albums/SM001-003/publications/SM001` through `SM003` | Original covers, track lists, PCM track offsets, playlists and offline album pages |
| `saeureblumen` | Acid/Paula composition, playable Acid pattern, rendering and mastering sources |
| `licht-im-hinterhof` | Original four-machine set and render/master reports |
| `warm` | Bernsteinfenster full score, eight-bar WARM excerpt, five-machine visit set, six patches and reports |
| `early/seven-pieces` | The seven earlier solo/duet scores and their original renderers |
| `early/first-duets` | Original first-release checksum manifest and a map to the identical sources under `seven-pieces/Duo` |

The historical German documentation is retained with private source links replaced by the public repository URL and affected checksum manifests refreshed. They describe their original packages, which also contained audio; not every listed media file is present in this source checkout. The album pages and playlists become playable when extracted together with the matching original audio package. Use this repository's root instructions for the current local start path.

For the album/early/Säureblumen renderers, set `SMALL_MACHINES_ENGINE` to the absolute path of this checkout's `dist` directory and run from the selected composition directory. Keep the source directory structure: composers, scores, local imports and generated work files are relative to it. The original READMEs list Node.js, Python, NumPy/SciPy and ffmpeg requirements where applicable. Full rendering can take time and several GB; video timing can use the already exported cue data without rendering audio again.

`licht-im-hinterhof` and `warm` use the studio's root `tools/render-ensemble.mjs` and `tools/render-warm-session.mjs`, respectively, followed by their matching mastering tools. The original four-machine Licht set remains distinct from the later five-machine WARM visit.
