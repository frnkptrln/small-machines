ZWEI MASCHINEN, DREI MOMENTE
Drei Originalkompositionen für SID/65 und PAULA/68
Small Machines · Frank + ChatGPT · 19. Oktober 2026

01  Fensterlicht auf Magnetband — 2:54 · 92 BPM · d-Moll
    Elektrische Tasten, ein runder Bass und eine warme Pulsmelodie.
    Aufbau, Hauptthema, offener Mittelteil, Wiederkehr und Auflösung.

02  Zwischen zwei Takten — 2:09 · 126 BPM · e-Moll
    Synkopierter Bass, eine Frage aus SID-Pulsen und eine Marimba-Antwort.
    Der Mittelteil nimmt den Beat ins halbe Tempo, dann kommt er zurück.

03  Was im Speicher bleibt — 2:47 · 72 BPM · fis-Moll / A-Dur
    Ein ruhiger Dialog aus Dreiecken, gläsernen Tasten und Flächen.
    Die Mitte verdichtet sich; am Ende bleibt ein heller, offener Akkord.

ANHÖREN
Im Ordner audio liegen MP3s (256 kbit/s) und unkomprimierte Stereo-WAVs
(44,1 kHz, 16 Bit). Die WAVs sind die Fassungen für weitere Bearbeitung.
Die Playlist spielt alle drei Tracks in Reihenfolge.

DIE KLÄNGE
Alle Instrumente stammen aus unseren beiden Small-Machines-Engines:
drei SID-Stimmen und vier Paula-Samplekanäle pro Stück. Es gibt keine
externen Aufnahmen, Vocals, kommerziellen Samples oder fremden Musikloops.
Die Melodien, Basslinien, Rhythmen und Arrangements wurden für diese EP
neu geschrieben. Die Stücke sind keine Exporte der vorhandenen Presets.

SID übernimmt Bass, Melodie und gehaltene Harmonietöne. Paula spielt
unter anderem Soft/Deep/Circuit Kick, Snare, Clap, Rim, Shaker, Hi-Hats,
Felt Electric, Soft Marimba, Glass Memory, Warm Pad und Music Box.

Die vorhandenen CPU-Kerne schreiben die Ton- und Sampleparameter.
Das Arrangement läuft hier außerhalb des 16-Step-Live-Racks, damit
Noten länger gehalten, Samples je Anschlag gewechselt und vollständige
Songformen gespielt werden können. Hohe Paula-Melodien verwenden bei
Bedarf heruntergesampelte Fassungen derselben PCM-Daten, damit Paulas
maximale Wiedergaberate die Tonhöhen nicht begrenzt.

Produktion: leichter Swing, gezielte Lautstärkeakzente, langsame Filter-
bewegung, sparsames Vibrato, dezentes Absenken des SID bei Bassdrums,
Echo und ein nachträglich berechneter Stereo-Raum. Lautheit ca. -16,
-15,5 und -18 LUFS, damit der ruhige dritte Titel auch leiser bleibt.

WEITERARBEITEN
scores/*.json enthalten alle zeitlich geordneten Noten, Gates, Samples,
Parameter und Formabschnitte. source/compose.mjs enthält die lesbare
Komposition; source/render.mjs den Renderer; source/master.py den Mix-
und Exportablauf. Das Score-Format ist ein Arrangementformat für diesen
Renderer. Es ist keine direkt im aktuellen Live-Rack importierbare Setdatei.

Zum Neurendern werden Node.js, Python mit numpy/scipy, ffmpeg und das
dist-Verzeichnis der vorhandenen Small-Machines-Site benötigt.
Verwendeter Engine-Stand: 1ec90acd0afdf02d58260ef9ff5c5ea02993b5d7.
Die Engine-Dateien selbst sind in diesem Musikpaket nicht dupliziert.

  node source/compose.mjs
  SMALL_MACHINES_ENGINE=/pfad/zur/site/dist node source/render.mjs
  python source/master.py

Ein einzelner Track lässt sich mit 01, 02 oder 03 hinter render.mjs wählen.
Die Zwischenfassungen werden im Ordner work erzeugt.

PRÜFUNG
Geprüft wurden beide Signalquellen, gültige Tonhöhen, endliche Audiosamples,
fehlende Übersteuerung, unerwartete lange Stille, Enden, Formlängen und
Lautheit der exportierten MP3s. audio-report.json enthält die Messwerte.
Die musikalische Wirkung ist eine Hörentscheidung, keine technische Messung.
