# A small world that can keep growing

Small Machines began with a question about building a virtual processor and making sound with C64- and Amiga-inspired machines. It grew into instruments, original pieces, three albums, a performance rack and an archive of how the music was made.

The musical center is melody, texture and the character of each machine. Tracker arrangements and titles such as **Diskettenblumen** are part of that identity. Solo records give each instrument space; collaborations let their different voices meet.

## What exists

The browser studio contains SID/65, PAULA/68, ACID/16, DRUM/08, WARM/06 and ENSEMBLE/05. Three albums hold eight pieces each: **Drei Stimmen, eine Stadt**, **Diskettenblumen** and **Wo die Maschinen sich treffen**. Seven compositions had appeared in earlier collections; the album versions use their own production and mastering.

**Säureblumen** pairs Acid and Paula. **Licht im Hinterhof** is the original 15-minute quartet session. **Bernsteinfenster** introduces WARM on its own, followed by **Besuch im Hinterhof** with all five instruments.

The code, scores and production scripts live together here. Large music packages are catalogued separately in the [archive](../archive/RELEASES.md). Each archive is a dated release, not an automatic mirror of later edits.

## Keep a piece reproducible

For each new recording, retain:

1. Its title, lineup, tempo, form and version.
2. The complete score or set, patches and any sample data.
3. The instrument source revision and rendering/mastering commands.
4. A listening copy, an uncompressed master when available, and measurements.
5. Checksums, video cues, artwork and eventually the corresponding video files.

A short playable preset may only be an excerpt. Preserve the complete composition as well. Keep old published recordings distinguishable from later versions, even when the notes are shared.

## Musical and technical care

Paula's perceived level and transient behavior deserve listening attention. Check actual peak levels and playback transitions before calling a click “clipping.” The original standalone engine, the smoothed album renderer and the ensemble's playback refinements are different production paths.

Describe the machines at their implemented fidelity. SID/65 has an instruction-level 6502 core; Paula's 68000 core supports a bounded music program. Neither is a full computer emulator. Acid, Drums and WARM use their own DSP rather than circuit-accurate manufacturer models.

The automated tests support development. They do not certify a live show, physical MIDI setup or mobile release.

## Next chapters

More instruments and samples, further solo albums and cross-machine records are natural continuations. Soundblaster is a future guest. Visuals, a homepage, a live setup and a possible iPhone app remain separate development goals.

For parallel work, keep a focused thread for each outcome—an instrument, album, video or release—and identify the score and revision it uses. Record resulting decisions and files in the repository so that the project can continue across conversations and tools.

