WARM/06 — BERNSTEINFENSTER
24. Oktober 2026

ZWEI ERSTE BEGEGNUNGEN
Bernsteinfenster: 3:25, 80 Takte bei 96 BPM, nur WARM/06.
Besuch im Hinterhof: 1:47, 48 Takte bei 112 BPM, alle fünf Maschinen.
MP3 ist die kleine Hörfassung; WAV ist Stereo-PCM, 44.1 kHz, 16 Bit.
Beide Fassungen sind gemastert. Keine übersteuerten PCM-Samples;
MP3-Lautheit jeweils etwa -18.2 LUFS, True Peak -4.7 / -2.7 dBFS.

SPIELEN
https://github.com/frnkptrln/small-machines
WARM/06 wählen, einen Klang aussuchen, „Einschalten & spielen“ anklicken.
Sechs Stimmen, Saw/Pulse/Sub/Noise, Hüllkurve, Filter und Stereo-Chorus.
Klangbank/01-WARM06.json: Bernsteinfenster (ursprüngliches Instrumentenpattern)
Klangbank/02-WARM06.json: Samtboden
Klangbank/03-WARM06.json: Staub im Sonnenlicht
Klangbank/04-WARM06.json: Langsame Gardinen
Klangbank/05-WARM06.json: Kassettenherz
Klangbank/06-WARM06.json: Die letzte Lampe

Bernsteinfenster-WARM06.json ist ein spielbarer Acht-Takte-Auszug aus der
vollständigen Komposition; im WARM-Studio über „Klang laden“ importieren.
Bernsteinfenster-Partitur.json enthält die vollständige 80-Takte-Komposition,
ihre sechs Abschnitte, Noten und Reglerwerte. Diese Partitur ist ein separates
Kompositionsformat und keine direkt importierbare Acht-Takte-Klangdatei.
Bernsteinfenster-Besuch-Ensemble.json im ENSEMBLE/05 über „Set laden“ öffnen.

ZUSAMMENSPIEL
Im WARM-Studio „Klang ins Ensemble übernehmen“ wählen. Im Ensemble eine
Szene auswählen und dort „WARM/06 übernehmen“ anklicken. Klang und alle acht
Takte werden übernommen, beim Spielen am nächsten Taktanfang.
Alte Vierer-Sets lassen sich weiterhin laden; die fünfte Stimme beginnt dort leer.

REC nimmt den tatsächlichen Ausgang samt Tastenspiel und Reglern auf.
WARM/06: maximal fünf Minuten pro Take; Ensemble: maximal zwanzig Minuten.
Der Acht-Takte-WAV-Export rechnet die Patternfolge mit Ausklang offline.

KLANGIDEE
Originale eigene Synthese, angelehnt an die Juno-Familie von Roland.
Keine originalgetreue Schaltungsnachbildung, keine Herstelleraufnahmen oder ROMs.
Architektonische Referenzen:
https://www.roland.com/us/products/rc_juno-60/
https://cdn.roland.com/assets/media/pdf/JUNO-60_OM.pdf

REPRODUKTION UND PRÜFUNG
Die Instrumenten- und Renderquellen sind im versionierten Small-Machines-Studio.
Dort: node tools/render-warm-session.mjs AUSGABEORDNER both
Danach: python3 tools/master-warm-session.py AUSGABEORDNER
71 automatische Testgruppen bestanden; alter Vierer-Klang bleibt in den
geprüften PCM-Ausschnitten bytegleich. Browser-Editor, Speicherung, Übergabe,
WAV-Export und die Medienplayer geprüft. AudioWorklet-Livewiedergabe war im
HTTP-Testfenster nicht verfügbar und braucht einen Test auf dem Zielgerät.
