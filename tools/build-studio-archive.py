#!/usr/bin/env python3
"""Export a pinned, portable studio source snapshot without duplicating recordings.

Usage: python3 tools/build-studio-archive.py --output /absolute/Studio.zip
The original Git-backed source remains canonical. No Library write occurs here.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile
import zipfile

BASELINE = '4cf5a47e58eee238f1fde0e68c38a178092c683f'
ALBUM_BASELINE = '1ec90acd0afdf02d58260ef9ff5c5ea02993b5d7'
ALBUM_HASHES = {
    'machine.mjs': '398e9378cc5e307374c4ce811358224af07884dd2716e6769f0d812282e89e28',
    'cpu.mjs': 'dcfdc5f33347ec5031eaa0029e8379509ef05d9f70b6e04f2526f0b8cd701feb',
    'assembler.mjs': '4c22912361a76f937b5ef477de8d9774fb362c9d4791840763c167604e7233d8',
    'paula.mjs': 'a4b32cad7ebc9a13ddb7645bbb0e9485beb2b9405c7f8de31853a5fd330a3def',
    'm68k.mjs': 'c17119d04970a5a110f9a6a5ad0631efc5ff7e46e4eddc93d2f00b62acfa1828',
    'sound-bank.mjs': 'b1656762cec65e07b2e7e3cfd85beb920fbef64607d49a2c1e8b476faa2bf120',
}

SERVER = r'''#!/usr/bin/env python3
"""Serve the exact source snapshot on localhost; reuse archived MP3 recordings."""
import argparse
import http.server
import mimetypes
import pathlib
import re
import urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
ARCHIVE = HERE.parent
DIST = HERE / 'Quellstand' / 'dist'
ALIASES = {
    '/audio/licht-im-hinterhof.m4a': ARCHIVE / '02-Stuecke' / 'Licht-im-Hinterhof.mp3',
    '/audio/bernsteinfenster.m4a': ARCHIVE / '05-WARM06' / 'Bernsteinfenster.mp3',
    '/audio/bernsteinfenster-besuch.m4a': ARCHIVE / '05-WARM06' / 'Bernsteinfenster-Besuch-im-Hinterhof.mp3',
}
mimetypes.add_type('text/javascript', '.mjs')
mimetypes.add_type('application/json', '.json')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def send_head(self):
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        audio = ALIASES.get(path)
        self.audio_remaining = None
        if audio is None:
            return super().send_head()
        if not audio.is_file():
            self.send_error(404, 'Aufnahme fehlt. Das Musikarchiv in denselben Small-Machines-Archiv-Ordner entpacken.')
            return None
        size = audio.stat().st_size
        start, end, status = 0, size - 1, 200
        requested = self.headers.get('Range')
        if requested:
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested.strip())
            if not match or not any(match.groups()):
                self.send_error(416, 'Nur ein Bytebereich wird unterstützt.')
                return None
            first, last = match.groups()
            if first:
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
            else:
                start = max(0, size - int(last))
            if start > end or start >= size:
                self.send_response(416)
                self.send_header('Content-Range', 'bytes */%d' % size)
                self.send_header('Content-Length', '0')
                self.end_headers()
                return None
            status = 206
        stream = audio.open('rb')
        stream.seek(start)
        self.audio_remaining = end - start + 1
        self.send_response(status)
        self.send_header('Content-Type', 'audio/mpeg')
        self.send_header('Content-Disposition', 'inline; filename="%s"' % audio.name)
        self.send_header('Content-Length', str(self.audio_remaining))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-cache')
        if status == 206:
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.end_headers()
        return stream

    def copyfile(self, source, outputfile):
        if self.audio_remaining is None:
            return super().copyfile(source, outputfile)
        remaining = self.audio_remaining
        try:
            while remaining:
                block = source.read(min(65536, remaining))
                if not block:
                    break
                outputfile.write(block)
                remaining -= len(block)
        except (BrokenPipeError, ConnectionResetError):
            pass  # A media player may cancel an earlier range after seeking.

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('Port muss zwischen 1 und 65535 liegen.')
    if not (DIST / 'index.html').is_file():
        parser.error('Quellstand/dist/index.html fehlt. Paket vollständig entpacken.')
    with http.server.ThreadingHTTPServer(('127.0.0.1', args.port), Handler) as server:
        print('SMALL MACHINES — lokales Studio', flush=True)
        print('Im Browser öffnen: http://127.0.0.1:%d/' % args.port, flush=True)
        print('Nur auf diesem Computer erreichbar. Beenden: Strg+C.', flush=True)
        missing = [str(p.relative_to(ARCHIVE)) for p in ALIASES.values() if not p.is_file()]
        if missing:
            print('Instrumente sind bereit. Für das Hörzimmer fehlen: ' + ', '.join(missing), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == '__main__':
    main()
'''

START = '''SMALL MACHINES — DAS STUDIO ZUM MITNEHMEN
Stand: 24. Oktober 2026

Dieses Zusatzpaket ergänzt die beiden Musikarchiv-ZIPs. Alle drei ZIPs in
denselben Zielordner entpacken; sie bilden gemeinsam Small-Machines-Archiv.
Hier liegt der Ordner 06-Studio. Vorhandene Musik wird nicht überschrieben.

STUDIO STARTEN
Voraussetzung: Python 3 und ein moderner Browser mit Web Audio/AudioWorklet.
Im Terminal in diesen Ordner 06-Studio wechseln und starten:

  macOS / Linux:  python3 serve-studio.py
  Windows:       py -3 serve-studio.py

Im Browser öffnen: http://127.0.0.1:8765/
Beenden im Terminal: Strg+C. Bei belegtem Port z.B. --port 8766 anhängen
und im Browser die entsprechend ausgegebene Adresse verwenden.

Eine HTML-Datei direkt per Doppelklick zu öffnen reicht für die Instrumente
nicht: JavaScript-Module, Worker und AudioWorklets benötigen den lokalen
Webserver. localhost ist ein vom Browser akzeptierter sicherer Kontext.
Audio muss trotzdem durch einen Klick auf Start aktiviert werden.
Der Server bindet ausschließlich 127.0.0.1; er veröffentlicht nichts im Netz.
Nach Installation von Python und Browser ist keine Internetverbindung nötig.

WAS HIER IST
SID/65, PAULA/68, ACID/16, WARM/06, DRUM/08 im ENSEMBLE/05, die ältere
SID/Paula-Live-Rack-Seite, Klangbanken, Pattern-/Set-Editoren und WAV-Export.
Die Klangquellen werden von den Instrumenten selbst erzeugt. Git-Verlauf,
Hosting-Zugangsdaten und personenbezogene Browserdaten sind nicht enthalten.

AUFNAHMEN IM HÖRZIMMER
Die originalen Webseiten verweisen auf drei M4A-Aufnahmen. Der lokale
Startserver bedient diese drei URLs mit den gleichnamigen musikalischen
MP3-Fassungen aus dem gemeinsamen Musikarchiv und korrektem audio/mpeg-Typ.
Die Webseiten und Instrumentenquellen bleiben dadurch bytegleich erhalten.
Die vorhandenen ZIPs müssen vollständig am selben Ort entpackt sein:
  02-Stuecke/Licht-im-Hinterhof.mp3
  05-WARM06/Bernsteinfenster.mp3
  05-WARM06/Bernsteinfenster-Besuch-im-Hinterhof.mp3
Fehlt Musik, funktionieren die Instrumente dennoch; nur die betreffenden
Hörzimmer-Aufnahmen fehlen. Aus dem Internet wird nichts nachgeladen.

PERSÖNLICHE SOUNDS UND SETS
Browser-Speicher gehört zur jeweiligen Browseradresse. Das lokale Studio
übernimmt nicht automatisch die gespeicherten Sounds des Online-Studios.
Dort gewünschte Projekte als JSON exportieren und lokal wieder importieren.
Die mitgelieferten Sets liegen unter Quellstand/dist/sets; eigene Samples
und spätere Live-Mitschnitte werden erst durch deinen Export Teil des Archivs.

QUELLSTAND UND NACHBAU
Quellstand/ enthält den unveränderten Stand der Instrumente vom 24.10.2026,
einschließlich Tests, Set-Partituren und der vorhandenen Render-/Masterwerkzeuge.
QUELLSTAND.json enthält Ausgangscommit und SHA256 jeder Datei.
WEG-DER-ERZEUGUNG.txt erklärt den Neuaufbau der Musik und die Abhängigkeiten.
Das Online-Studio kann später weiterentwickelt sein; dieser Stand bleibt fix.
Die ZIP ist eine lauffähige Quellkopie, kein vollständiger Git-Verlaufs-Export.

HINWEIS ZUR PRÜFUNG
Quellkopien und HTTP-Auslieferung wurden geprüft. Die bekannten automatischen
Instrumententests begleiten den Quellstand. Live-Audio auf deinem Gerät,
MIDI, iPhone-Verhalten und längere Bühnen-Sessions brauchen praktische Tests.
'''

PROCESS = '''SMALL MACHINES — VON DER PARTITUR ZUR AUFNAHME

Die Musik ist aus eigenen Noten, Patterns und Synthese-/Sampleprogrammen
gebaut. Die fertigen MP3s sind Hörfassungen; die bearbeitbaren musikalischen
Daten und der Tonerzeugungs-Code bleiben separat nachvollziehbar.

1. PARTITUR / SET
Die Albumwerkstatt im Ordner 03-Werkstaetten enthält 24 vollständige JSON-
Partituren für SM001–003. Zeitangaben stehen in Sechzehnteln. Tempo und Swing
werden vom dort enthaltenen Renderer in Abspielzeit und Sampleframes umgesetzt.
Licht im Hinterhof hat ein vollständiges Ensemble-Set mit acht Szenen; es
muss weder aus dem Ton herausgehört noch als Sequencer neu gebaut werden.
Die neue Video-Übergabe stellt diese musikalische Zeitachse separat bereit.

2. INSTRUMENTE
Die Noten steuern SID/65 und PAULA/68 über die vorhandenen CPU-/Klangmodelle.
ACID/16, DRUM/08 und WARM/06 sind eigene DSP-Instrumente. Diese Programme sind
musikalische Annäherungen, keine vollständigen Hardware-Emulationen und keine
lizenzierten Roland-Produkte. Hersteller-ROMs oder fremde Aufnahmen fehlen.

3. ROHRENDER
Node.js führt die Maschinen ohne Browser aus. Die Renderer schreiben Stereo-
WAV mit 44.100 Hz und 32-Bit-Fließkomma sowie Partituren und Prüfberichte.
Im Ensemble führt ein gemeinsamer Sampletakt alle Maschinen und Szenen.
Die Rohfassung enthält Ausklang und End-Fade; die Skripte benennen diese Werte.

4. MASTER / HÖRFASSUNG
ffmpeg und ffprobe erzeugen und prüfen WAV, MP3 und M4A. Die Session-Master
nutzen 24-Hz-Hochpass, feste Pegelanhebung und End-Fade. Die Pegelanalyse
bestimmt den festen Gain; sie ersetzt kein Hören. Album-Mastering verwendet
seinen gesonderten, mitgelieferten Weg einschließlich der Paula-Glättung.
Für exakt identische komprimierte Bytes müssen auch Encoder-Versionen und
Metadaten übereinstimmen; musikalische Reproduzierbarkeit allein garantiert
keine bytegleichen MP3-/AAC-Dateien über verschiedene ffmpeg-Versionen.

5. VERSION UND ARCHIV
Quellstand/ ist fest an den in QUELLSTAND.json angegebenen Git-Commit gebunden.
Die sechs für SM001–003 dokumentierten Engine-Dateien wurden gegen deren
engine-version.json geprüft: Sie sind im enthaltenen aktuellen Quellstand
bytegleich zur früher verwendeten Album-Version. Die Album-Partituren und
ihre eigenen Render-/Masterquellen bleiben in der Albumwerkstatt bewahrt.
Spätere Änderungen sollten einen neuen Snapshot und neue Berichte erhalten.

LOKALE VORAUSSETZUNGEN
Studio: Python 3 (Standardbibliothek), moderner Browser; keine npm-Pakete.
Rendern/Tests: moderne Node.js-Version mit ESM, Worker und node:test.
Mastering: Python 3, ffmpeg und ffprobe im PATH.
Albumwerkstatt zusätzlich: numpy und scipy; ein vollständiger Album-Neuaufbau
braucht mehrere GB freien Arbeitsbereich. Nicht alle 24 Stücke neu rendern,
wenn nur Zeitmarken oder Notendaten für ein Video benötigt werden.

ENSEMBLE / LICHT IM HINTERHOF NEU ERZEUGEN
Im Ordner 06-Studio/Quellstand ausführen (Beispielpfad durch eigenen ersetzen):
  node tools/render-ensemble.mjs /absoluter/pfad/Render-Licht
  python3 tools/master-ensemble.py /absoluter/pfad/Render-Licht
Windows: python3 ggf. durch py -3 ersetzen und z.B. C:\\Musik\\Render-Licht nutzen.
Der Renderer erzeugt das ursprüngliche Quartett-Set: 480 Takte bei 128 BPM,
900 Sekunden Musik plus vier Sekunden Ausklang. WARM bleibt darin stumm.

WARM / BERNSTEINFENSTER UND BESUCH NEU ERZEUGEN
Im selben Quellstand-Ordner:
  node tools/render-warm-session.mjs /absoluter/pfad/Render-Warm both
  python3 tools/master-warm-session.py /absoluter/pfad/Render-Warm
Das erste Stück dauert 205 Sekunden, das Fünfer-Set 106,857 Sekunden mit Tail.

SM001–003 NEU ERZEUGEN
03-Werkstaetten/Small-Machines-Albumwerkstatt-01.zip separat entpacken.
Dessen README.txt befolgen und SMALL_MACHINES_ENGINE auf das absolute
Verzeichnis 06-Studio/Quellstand/dist setzen. Die sechs dort verwendeten
Module sind gegen engine-version.json verifiziert.
Aus dem entpackten Werkstattverzeichnis:
  node source/compose-albums.mjs
  node source/check-recording.mjs
  python3 source/build-albums.py
  python3 source/package-albums.py
build-albums.py lässt sich laut Werkstatt-README auf SID, PAULA, DUO oder
eine einzelne ID wie PAULA-05 beschränken. Original-Partituren vorher sichern,
wenn du sie selbst bearbeitet hast: Der Komponist erzeugt 17 Stücke erneut.

TESTS
Im Quellstand-Ordner: node --test tests/*.test.mjs
Die Suite enthält 71 Testgruppen. Sie prüft CPU-/Klangmodelle, Transport,
Import/Export und Aufnahmeverhalten. Sie ist kein Zertifikat für Bühnenbetrieb.

ARCHIV BAUEN
tools/build-studio-archive.py liegt als später ergänztes Verpackungswerkzeug
unter 06-Studio/Build-Werkzeug/. Es benötigt das ursprüngliche Git-Repository
mit dem genannten Commit; die portable Quellkopie allein enthält diesen
Git-Verlauf nicht. Das Werkzeug kopiert nur explizit erlaubte Dateibereiche,
prüft die Album-Engine-Hashes und baut diesen Studio-Teil reproduzierbar.
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=pathlib.Path)
    parser.add_argument('--staging', type=pathlib.Path)
    parser.add_argument('--repository', type=pathlib.Path,
                        default=pathlib.Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    repo = args.repository.resolve()
    out = args.output.resolve()
    if out.suffix != '.zip':
        parser.error('--output muss eine .zip-Datei sein.')
    temporary = tempfile.TemporaryDirectory(prefix='small-machines-studio-') if args.staging is None else None
    staging = pathlib.Path(temporary.name) if temporary else args.staging.resolve()
    top = staging / 'Small-Machines-Archiv' / '06-Studio'
    top.mkdir(parents=True, exist_ok=True)

    def git(*arguments):
        return subprocess.check_output(['git', '-C', str(repo), *arguments])

    assert git('rev-parse', BASELINE).decode().strip() == BASELINE
    names = git('ls-tree', '-r', '--name-only', BASELINE).decode().splitlines()
    accepted = [n for n in names if n == 'README.md' or n.startswith(('dist/', 'tests/', 'tools/'))]
    accepted = [n for n in accepted if not n.startswith(('dist/audio/', 'dist/downloads/'))]
    assert all(not any(part.startswith('.') for part in pathlib.PurePosixPath(n).parts) for n in accepted)
    records, exported = [], []

    def write(relative, data, origin):
        target = top / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        exported.append(target)
        records.append({'path': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'origin': origin})

    for name in accepted:
        write('Quellstand/' + name, git('show', BASELINE + ':' + name), 'git:' + BASELINE + ':' + name)
    for name, expected in ALBUM_HASHES.items():
        assert hashlib.sha256((top / 'Quellstand' / 'dist' / name).read_bytes()).hexdigest() == expected, name

    write('serve-studio.py', SERVER.encode(), 'portable-local-server:2026-10-24')
    write('START-STUDIO.txt', START.encode(), 'archive-documentation:2026-10-24')
    write('WEG-DER-ERZEUGUNG.txt', PROCESS.encode(), 'archive-documentation:2026-10-24')
    write('Build-Werkzeug/build-studio-archive.py', pathlib.Path(__file__).read_bytes(),
          'packaging-tool-added-after-baseline:2026-10-24')
    manifest = {
        'format': 'small-machines-studio-snapshot', 'version': 1, 'date': '2026-10-24',
        'studio_url': 'https://github.com/frnkptrln/small-machines', 'source_commit': BASELINE,
        'source_file_count': len(accepted),
        'audio_policy': 'Original M4A recordings excluded. Local server maps three media URLs to existing archive MP3s, with audio/mpeg and byte-range support.',
        'excluded': ['.git history', '.openai hosting identity', 'dist/audio recordings', 'dist/downloads artifacts', 'browser localStorage and custom samples'],
        'album_engine_verification': {'original_commit': ALBUM_BASELINE, 'sha256': ALBUM_HASHES, 'matches_current_source': True},
        'files': records,
    }
    manifest_path = top / 'QUELLSTAND.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    exported.append(manifest_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for path in sorted(exported):
            info = zipfile.ZipInfo(path.relative_to(staging).as_posix(), (2026, 10, 24, 12, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, path.read_bytes())
    with zipfile.ZipFile(out) as z:
        assert z.testzip() is None
        for record in records:
            b = z.read('Small-Machines-Archiv/06-Studio/' + record['path'])
            assert len(b) == record['bytes'] and hashlib.sha256(b).hexdigest() == record['sha256']
    print(json.dumps({'output': str(out), 'bytes': out.stat().st_size, 'source_files': len(accepted),
                      'entries': len(exported), 'source_commit': BASELINE,
                      'staging': str(staging) if temporary is None else None}))
    if temporary:
        temporary.cleanup()


if __name__ == '__main__':
    main()
