SMALL MACHINES — SOLOS
Vier neue Originalkompositionen · 19. Oktober 2026

SID / drei Synthesestimmen

01  Drei Stimmen im Neon — 2:17 · 118 BPM · a-Moll
    Pulsmelodie, Sägezahnbass und eine dritte Stimme, die zwischen
    Bassdrum, Snare, Hi-Hat und kleinen Fills wechselt. Auch die
    Percussion entsteht im SID aus Dreieck, Rauschen und Frequenzverläufen.
    Form: Einschalten / Neon / Bewegung / Leere Straße / Rückkehr / Letztes Licht.

02  Ein Bit von dir — 2:31 · 80 BPM · h-Moll / D-Dur
    Ein ruhiges Trio aus Dreiecksmelodie, gehaltenem Bass und kurzen
    Puls-Arpeggien. Im Mittelteil öffnet sich die Begleitung zur Antwort.
    Form: Ein erster Ton / Nachricht / Antwort / Nähe / Bleibt offen.

PAULA / vier Samplekanäle

01  Papiermond — 2:30 · 94 BPM · f-Moll
    Elektrische Tasten, ein runder Samplebass und gezupfte Antworten.
    Ein Kanal teilt sich die Drum-Sounds; die anderen bleiben für Bass,
    Keys und Melodie beziehungsweise Fläche frei.
    Form: Papierlicht / Mondbahn / Schwerelos / Wieder am Fenster / Gute Nacht.

02  Diskettenblumen — 2:03 · 132 BPM · c-Moll
    Ein lebhaftes Tracker-Stück mit Marimba-Fragen, gläsernen Antworten,
    beweglichem Bass und einem ruhigen Zwischenraum vor der Wiederkehr.
    Form: Laufwerk / Blüten / Alles offen / Zwischenraum / Noch einmal Sommer / Auswerfen.

QUELLEN UND KLANG
Die Stücke wurden eigens als Solokompositionen geschrieben. Jeder Score
enthält ausschließlich Notenereignisse seines gewählten Klangerzeugers.
Der Renderer erzeugt jeweils nur eine SID- oder eine Paula-Instanz.

SID: maximal drei gleichzeitig spielende Synthesestimmen. Es gibt keine
PCM-Drumspur. Die 6502-Engine schreibt auch die Hüllkurven, Rauschparameter
und die schnellen Frequenzverläufe der Bassdrum.

Paula: maximal vier gleichzeitig spielende Samplekanäle. Alle Samples
stammen aus unserer eigenen synthetisierten Soundbank. Die 68000-Engine
schreibt Samplepointer, Perioden und Lautstärken. Für höhere Melodien
werden bei Bedarf dieselben PCM-Daten bandbegrenzt heruntergesampelt,
damit Paulas maximale Wiedergaberate die Stimmung nicht verändert.

Echo, zurückhaltender nachträglicher Stereo-Raum, EQ und Lautheitsanpassung
verarbeiten ausschließlich den Klang der jeweiligen Maschine. SID ist
vor dem Raum mono; Paula besitzt ihre vier Stereo-Kanalpositionen. Der
Nachmix zieht sehr tiefe Frequenzen in die Mitte.

DATEIEN UND WEITERARBEITEN
MP3: 256 kbit/s, Stereo. WAV: 44,1 kHz / 16 Bit, Stereo.
Die WAV-Dateien sind für die weitere Bearbeitung gedacht.

scores/*.json: vollständige Noten, Gates, Instrumentwechsel und Form.
source/compose.mjs: lesbare Kompositionen.
source/render.mjs: Offline-Renderer für genau einen Klangerzeuger.
source/master.py: Raum, Mix, Loudness, MP3/WAV und Exportkontrolle.
verification/*-render.json: Signalenergie und CPU-Befehlszahlen beider Quellen.
audio-report.json: Dauer, Lautheit und Spitzenpegel der fertigen Dateien.

Die Scores sind vollständige Offline-Arrangements und lassen sich noch
nicht direkt als Set in das aktuelle 16-Step-Live-Rack importieren.

Erforderlich zum Neurendern: Node.js, Python mit numpy/scipy, ffmpeg und
das dist-Verzeichnis unserer bestehenden Small-Machines-Site.
Engine-Stand: 1ec90acd0afdf02d58260ef9ff5c5ea02993b5d7.

  node source/compose.mjs
  SMALL_MACHINES_ENGINE=/pfad/zur/site/dist node source/render.mjs
  python source/master.py

Hinter render.mjs kann SID oder PAULA stehen, um nur eine Seite zu rendern.
Die Engine-Dateien selbst sind im Musikpaket nicht dupliziert.

PRÜFUNG
Geprüft: exklusive Klangerzeugung, Stimmen-/Kanalgrenzen, Tonhöhenbereich,
endliche Samples, Signal beider Soloseiten, unbeabsichtigte Stille,
vollständige WAV-/MP3-Dauer und nicht übersteuernde Exportpegel.
Die musikalische Wirkung bleibt eine Hörentscheidung.
