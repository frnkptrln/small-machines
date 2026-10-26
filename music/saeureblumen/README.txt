SMALL MACHINES / ERSTE BEGEGNUNGEN
SM004 — Säureblumen
ACID/16 × PAULA/68

Eine neue Originalkomposition. 124 BPM, d-Moll, 96 Takte, 3:10,806 Minuten.
Eine monophone Bassstimme und höchstens vier Paula-Samplekanäle gleichzeitig.
Keine externen Musikaufnahmen, Roland-Samples oder ROMs.

INSTRUMENT
https://github.com/frnkptrln/small-machines
Eigener digitaler Basssynthesizer, inspiriert von der Spielweise klassischer
Acid-Maschinen. Keine originalgetreue TB-303-Schaltungsemulation.
16 Schritte, Sägezahn/Rechteck, Cutoff, Resonanz, Filterhüllkurve, Akzente,
Slide, Stereo-Echo, Pattern-Speicher, JSON, WAV und Live-Aufnahme.

BEARBEITEN
Saeureblumen-ACID16-Pattern.json kann direkt in ACID/16 geladen werden.
Es enthält das Grundmotiv als ein Takt. Der vollständige Song mit mehreren
Abschnitten und Paula-Stimmen steht in scores/SM004-Saeureblumen.json.
Die Site spielt das Ein-Takt-Pattern; der Song ist separat arrangiert.

PARTITUR
at und gate zählen Sechzehntel ab Stückanfang. Paula voice zählt 0 bis 3:
0 = Kick, 1 = Snare/Hats, 2 = Melodie, 3 = gebrochene Akkorde.
Jeder Kanal spielt genau ein Sample gleichzeitig.
Acid: note ist die MIDI-Note. accent betont den Anschlag. slide bedeutet
hier eine eingehende Verbindung ohne neue Hüllkurve; ein fehlendes gate
an der vorigen Note hält den Ton bis zum nächsten Ereignis offen.
Im Browser-Pattern bedeutet S dagegen die ausgehende Verbindung.
tone-Ereignisse bewegen Cutoff, Resonanz, Env Mod und Decay.

ABSCHNITTE (Taktzählung ab 1)
01–08  Erstes Licht
09–24  Die Wurzeln
25–40  Blüten aus Kupfer
41–48  Ein stiller Innenhof
49–64  Der Garten antwortet
65–80  Alles in Bewegung
81–88  Nachglühen
89–96  Letzte Blüten

RENDERING
Voraussetzungen: Node.js, Python mit numpy/scipy, ffmpeg und ffprobe.
Der passende Small-Machines-Site-Quellstand ist separat im Site-Projekt:
Commit 2b25842577f4f1bc3b3187da9ca5f77c299e836c.
Die bereits dort versionierten Instrumentenmodule sind nicht in diesem
Kompositionspaket dupliziert. Benötigt wird dessen dist-Verzeichnis.

1. node source/compose.mjs
   Erzeugt die Originalpartitur erneut. Überschreibt eigene Partituränderungen!
   Zum Rendern einer bearbeiteten JSON-Partitur diesen Schritt überspringen.
2. SMALL_MACHINES_ENGINE=/pfad/zum/site/dist node source/render.mjs
3. python source/master.py

Die Partitur ist deterministisch komponiert. Der kleine Hall verwendet
einen festen Zufalls-Seed für seine Impulsantwort. Die Basslinie wird live
aus dem neuen Synthesemodell berechnet. Paula spielt die ursprünglichen
8-Bit-Klangbank-Samples durch den vorhandenen 68000-/DMA-Musikkern.
Der Offline-Adapter interpoliert PCM mit windowed sinc und glättet
Samplewechsel/Stops über 3 ms. Hohe Noten werden durch vorbereitendes
Resampling innerhalb des Paula-Periodenbereichs gehalten.

AUDIO
WAV: 44,1 kHz / 16-Bit / Stereo.
MP3: 192 kbit/s / Stereo; Titel- und Interpretenmetadaten eingebettet.
Gemessen am MP3: −17,27 LUFS, −2,56 dBTP, 6,20 LU Dynamikbereich (LRA).
Keine geclippten Samples im Rohmix oder WAV; das WAV endet bei null.
Die Messprotokolle stehen unter verification/.

PRÜFUNG
49 automatisierte Tests der Site bestanden, einschließlich Oszillatorhöhe,
Slide/Accent, Sequencer-Timing, Pegeln, WAV und tatsächlichen Aufnahmebytes.
Die Aufnahme wurde vollständig berechnet und signaltechnisch geprüft.
Ein subjektiver Hörtest, Browserdarstellung sowie Bedienung und Audio auf
realen Geräten wurden in dieser Umgebung nicht geprüft.

Small Machines · Oktober 2026
