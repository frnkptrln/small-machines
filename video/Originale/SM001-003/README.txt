SMALL MACHINES — ALBUMWERKSTATT 01
24 Stücke / 3 Alben / 17 neue Kompositionen

Inhalt
  scores/         Vollständige Partituren, Zeitangaben in Sechzehnteln
  source/         Komposition, Aufnahme, Mastering, Paketbau
  verification/   Prüfungen und Messungen pro Stück
  catalogue/     Albumidee, vollständiger Katalog, nächste Gäste als Entwurf
  audio-report.json  Dauer, Lautheit und Spitzenpegel der fertigen Stücke
  engine-version.json  Version und Prüfsummen der getrennten Instrumentenquelle

Die MP3-Alben und MP3-Einzelstücke werden getrennt bereitgestellt. Diese
Werkstatt enthält die bearbeitbaren musikalischen Quellen, keine Audiodateien.

Voraussetzungen für einen Neuaufbau
  Node.js; Python 3 mit numpy/scipy; ffmpeg und ffprobe.
  Das vorhandene Small-Machines-Site-Projekt, Version siehe engine-version.json.
  Setze SMALL_MACHINES_ENGINE auf dessen dist-Verzeichnis.
  Die Instrumentenquelle bleibt im bestehenden Projekt und wird hier nicht
  als zweite Kopie des git-verwalteten Projekts gespeichert.

Aus dem Werkstattverzeichnis:
  node source/compose-albums.mjs
  node source/check-recording.mjs
  python3 source/build-albums.py
  python3 source/package-albums.py

Die sieben älteren Partituren liegen bereits unter scores/. Der Komponist
schreibt die siebzehn neuen. Die Reihenfolge steht in catalogue/catalogue.json.
build-albums.py kann mit SID, PAULA, DUO oder einer ID wie PAULA-05 eingeschränkt
werden. Der komplette Neuaufbau benötigt einige GB freien Arbeitsbereich.

Hinweise
  • Jede Soloaufnahme erzeugt ausschließlich die ausgewählte Maschine.
  • Die vorhandenen sieben Kompositionen behalten ihre Noten; dies sind neue
    Albumaufnahmen mit angepasster Lautheit und geglätteter Paula-Wiedergabe.
  • Tonhöhe kurzer Loops bleibt beim Vorbereiten schneller PCM-Töne erhalten.
  • Die Web-Instrumente wurden für dieses Albumprojekt nicht verändert.
  • Alle Klangquellen sind im Projekt synthetisch erzeugt; keine Fremdaufnahmen.
  • Digitale Prüfungen ersetzen keine Hörprüfung auf dem eigenen Wiedergabegerät.

Roland-bezogene Gäste stehen ausschließlich als Plan in catalogue/Die-kleine-Welt.txt.
