# Recording archives

The public archive assets below have been prepared and checked. **Their upload is not yet confirmed**; a filename in this table is not a working download link. Check the repository's [Releases page](https://github.com/frnkptrln/small-machines/releases) for published assets.

| Asset | Contents |
| --- | --- |
| `Small-Machines-Archive-2026-10-26.zip` | Three albums as individual-track packages, newer recordings and available WAVs, musical workshops, WARM scores/patches and the common offline index |
| `Small-Machines-Archive-Originals-2026-10-26.zip` | Continuous album MP3s and earlier releases |

Extract both into the same parent folder. They form `Small-Machines-Archiv`; open `START-HIER.html` to play the saved audio. Instrument sources and video timing data are in the repository separately.

The public export removes private account/file metadata, personal chat workflow notes and private download links recursively from the archive documentation, including nested workshops. Audio files and musical score data remain byte-identical. Nested ZIPs are public variants with private source links removed and affected checksum manifests refreshed. Original private archive packages are retained separately. One temporary MP3 entry remains inside the historical SM003 ZIP; it is not a ninth album track.

`manifest.json` records the prepared asset hashes/sizes and every supplied recording, including its path inside nested packages. No new licence has been assigned by this migration. Complete WAV/FLAC album masters and the reported music-video files were not supplied.

## Video cues and listening-room files

`Small-Machines-Video-Cues-2026-10-26.zip` contains the generated `video/Cues/` data. Extract it at the repository root, or regenerate it with `node video/generate-cues.mjs`.

The three original listening-room files are prepared separately: `licht-im-hinterhof.m4a`, `bernsteinfenster.m4a` and `bernsteinfenster-besuch.m4a`. Once downloaded, put them in `dist/audio/`. Their checksums are in the manifest. Their public upload is also pending.

## Upload the prepared files

With the prepared assets on your computer, verify them without a network call:

```sh
python3 tools/publish-archives.py /path/to/prepared-assets --check-only
```

The same helper can create a **draft** release using an authenticated [official GitHub CLI](https://cli.github.com/manual/gh_release_create):

```sh
python3 tools/publish-archives.py /path/to/prepared-assets --tag archive-2026-10-26 --target codex/import-small-machines
```

It checks every size and SHA256 first, never overwrites an existing release, and leaves publication to the reviewer. The source branch must already exist. Updating the manifest to `published` requires checking the actual release and its assets.
