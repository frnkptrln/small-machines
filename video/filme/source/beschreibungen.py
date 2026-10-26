#!/usr/bin/env python3
"""Videobeschreibungen.txt aus den Partituren erzeugen (Kapitelmarken = Abschnittsanfänge)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import Score

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from render import REPO, SCORES

FILME = [
    ('Drei-Stimmen-im-Neon', 'Drei Stimmen im Neon', 'SID/65', SCORES['neon'],
     "Drei Neonröhren an einer nassen Straße, jede zur Wellenform ihrer Stimme gebogen: Puls für die Melodie, "
     "Sägezahn für den Bass, Rauschen und Dreieck für das Schlagwerk. Mit jeder Note bekommt die Röhre die "
     "Zyklenzahl der neuen Tonhöhe, zündet mit kurzem Flackern und leuchtet so hell, wie die Hüllkurve des Chips "
     "es vorgibt. Der Regen spiegelt die drei Stimmen."),
    ('Ein-Bit-von-dir', 'Ein Bit von dir', 'SID/65', SCORES['bit'],
     "Zwei Lichter weit auseinander. Die Dreiecksmelodie schickt jede Note als Bit auf einem Bogen hinüber – "
     "die Tonhöhe ist die Höhe des Bogens –, die Pulsstimme antwortet von rechts, der gehaltene Bass ist der "
     "Horizont. Jeder Flug lässt eine Spur zurück; mit der Zeit webt sich eine Brücke. In „Nähe“ rücken die "
     "Lichter zusammen, der Abstand bleibt offen."),
    ('Papiermond', 'Papiermond', 'PAULA/68', SCORES['papiermond'],
     "Ein Scherenschnitt-Diorama. Jede Taste des E-Pianos stanzt ein Loch in den Mond, von links nach rechts im "
     "Lauf des Stücks, die Tonhöhe bestimmt die Höhe im Mond – so nimmt der Mond aus Noten zu. Die gezupften "
     "Antworten zünden Fenster in der Dächersilhouette, der Subbass lässt das Licht hinter dem Papier atmen, "
     "die Bassdrum rüttelt an den Schichten, der Shaker streut Papierstaub. „Schwerelos“: gläserne Kreise "
     "steigen. „Gute Nacht“: die Vorhänge schließen sich."),
    ('Diskettenblumen', 'Diskettenblumen', 'PAULA/68', SCORES['diskettenblumen'],
     "Die Zeit läuft als Winkel – acht Takte sind eine Umdrehung –, der Radius wächst mit dem Stück. Jedes "
     "Sample wird ein Blatt an der Stelle, an der der Lesekopf gerade steht: Bass nach innen als Kelch, Marimba "
     "Gold, Glas Eis, Toms Glut, Hats Pollen, Claps helle Striche, Tasten und Fläche breite Blätter im "
     "Zwischenraum. Wiederholung in der Musik wird Symmetrie in der Blume. Am Ende wird die Diskette "
     "ausgeworfen; ein Nachbild bleibt."),
    ('Fensterlicht-auf-Magnetband', 'Fensterlicht auf Magnetband', 'SID/65 × PAULA/68',
     SCORES['magnetband'],
     "Ein Tonband läuft zwischen zwei Spulen durchs Bild. Am Aufnahmekopf schreibt Paula ihre Samples als "
     "Spuren – Bassdrum als Balken, Tasten als Striche in Tonhöhe, Glas hell, Snare als Kratzer, Shaker als "
     "Staub –, und das Geschriebene wandert nach links hinaus. Der SID ist das Fensterlicht: die langen "
     "Dreiecksstimmen breite Lichtbahnen, die Pulsmelodie ein schmaler Streifen, der mit der Tonhöhe wandert, "
     "der Bass ein Bodenlicht. „Band läuft aus“: das Ende passiert den Kopf."),
    ('Zwischen-zwei-Takten', 'Zwischen zwei Takten', 'SID/65 × PAULA/68', SCORES['takte'],
     "Ein Tracker-Bildschirm: sieben Spalten – drei SID-Stimmen, vier Paula-Kanäle –, eine Zeile je "
     "Sechzehntel, 64 Zeilen je Pattern, 16 Patterns. Frage links, Antwort rechts; der Cursor bleibt in der "
     "Mitte, die Partitur läuft hindurch, was kommt, steht schon dünn darunter. Dahinter Copper-Bars, die die "
     "Bassdrum aufleuchten lässt. „Offene Türen“: die Hälften rücken auseinander. „Halbe Geschwindigkeit“: "
     "höhere Zeilen, langsamerer Lauf."),
    ('Was-im-Speicher-bleibt', 'Was im Speicher bleibt', 'SID/65 × PAULA/68', SCORES['speicher'],
     "Ein dunkles Feld, in dem jeder Klang eine Glut hinterlässt. Der Ort einer Note ist ihre Tonhöhe: der "
     "Tonname ist die Richtung (Quintenzirkel), die Oktave der Abstand von der Mitte. So wird die Tonart zu "
     "einer Gegend am Himmel, Wiederholung macht sie heller. Die SID-Melodie zieht Linien von Note zu Note wie "
     "in einer Sternkarte. Die Kamera zieht sich zurück, bis das Ganze ein Sternbild ist; ganz schwach "
     "erscheinen die Nachbilder der anderen sechs Filme. Der letzte Akkord bleibt."),
    ('Saeureblumen', 'Säureblumen', 'ACID/16 × PAULA/68', SCORES['saeureblumen'],
     "Eine Radierung entsteht. Die Kupferplatte liegt unter dunklem Ätzgrund; die Acid-Bassline ist Nadel und "
     "Säure zugleich: Wo eine Note klingt, beißt sich die Linie ins Kupfer, solange die Note dauert. Pausen "
     "bleiben ungeätzt, Slides laufen durch, Akzente beißen tiefer; der Cutoff ist die Stärke der Säure, die "
     "Resonanz ihr Brodeln. Die Nadel folgt einer Pflanze: Same, Wurzeln, Stängel, Ranken. Spieluhr und Glas "
     "setzen Blüten, das E-Piano Blätter, die Fläche Aquatinta, die Bassdrum ist der Druck der Presse. "
     "„Nachglühen“: die Säure wird abgespült, die Platte eingefärbt. „Letzte Blüten“: der Abzug."),
]

MITWIRKENDE = ("Musik und Instrumente: Small Machines – Frank mit ChatGPT (die Maschinen SID/65, PAULA/68, "
               "ACID/16 und DRUM/08 sind virtuelle Chip-Instrumente; Quellen, Partituren und Studio: github.com/frnkptrln/small-machines).\n"
               "Bild: Frank mit Claude. Der Film reagiert nicht auf das Audiosignal, er ist aus der Partitur "
               "gerechnet – aus jeder Note, jedem Sample, jeder Hüllkurve –, deshalb sitzt jedes Bildereignis "
               "auf dem Sechzehntel, an dem es in der Musik steht.")


# Welche Aufnahme der Film trägt (seit 27.10.2026 die Albumfassungen; Säureblumen: die Single)
AUFNAHME = {
    'Drei-Stimmen-im-Neon': 'Aufnahme: SM001 „Drei Stimmen, eine Stadt“, Titel 2',
    'Ein-Bit-von-dir': 'Aufnahme: SM001 „Drei Stimmen, eine Stadt“, Titel 4',
    'Papiermond': 'Aufnahme: SM002 „Diskettenblumen“, Titel 4',
    'Diskettenblumen': 'Aufnahme: SM002 „Diskettenblumen“, Titel 2',
    'Fensterlicht-auf-Magnetband': 'Aufnahme: SM003 „Wo die Maschinen sich treffen“, Titel 2',
    'Zwischen-zwei-Takten': 'Aufnahme: SM003 „Wo die Maschinen sich treffen“, Titel 3',
    'Was-im-Speicher-bleibt': 'Aufnahme: SM003 „Wo die Maschinen sich treffen“, Titel 6',
    'Saeureblumen': 'Aufnahme: Single SM004 „Säureblumen“ (Erste Begegnungen, 2026)',
}


def mmss(t):
    t = int(round(t))
    return f'{t // 60}:{t % 60:02d}'


def main(out_path):
    L = []
    L.append('SMALL MACHINES — VIDEOBESCHREIBUNGEN')
    L.append('Texte zum Einfügen bei YouTube, Vimeo, Mastodon usw. – je Film Titel, Beschreibung, Mitwirkende,')
    L.append('Kapitel (Zeitmarken der Abschnitte, aus der Partitur). Die Kapitelzeilen im YouTube-Format')
    L.append('(erste Marke 0:00) übernimmt YouTube automatisch als Kapitel.')
    L.append('')
    for fn, title, bes, score, text in FILME:
        s = Score(os.path.join(REPO, score))
        bar_s = 240.0 / s.bpm
        album = AUFNAHME[fn]
        L.append('=' * 78)
        L.append(f'{title} — Small Machines · {bes}')
        L.append('=' * 78)
        L.append(text)
        L.append('')
        key = {'D minor': 'd-Moll'}.get(s.key, s.key)
        L.append(f'Small Machines · Besetzung: {bes} · {album} · {s.bpm} BPM · {key}')
        L.append(MITWIRKENDE)
        L.append('')
        L.append('Kapitel:')
        for name, a, b, ba, bb in s.sections:
            L.append(f'{mmss(a)} {name}')
        L.append('')
    # Trailer
    L.append('=' * 78)
    L.append('Allein und zusammen — Trailer · Small Machines')
    L.append('=' * 78)
    L.append("Sieben Stücke, sieben Filme, in 32 Sekunden: SID/65 allein, PAULA/68 allein, beide zusammen. "
             "Jeder Schnitt zeigt einen Film mit seiner eigenen Musik, der Einstieg liegt auf dem Taktanfang; "
             "am Ende der letzte Akkord von „Was im Speicher bleibt“.")
    L.append('')
    L.append('Small Machines · Besetzung: SID/65 · PAULA/68 · Ton: die Albumfassungen (SM001–SM003)')
    L.append(MITWIRKENDE)
    L.append('')
    L.append('Schnitte:')
    t = 0.0
    for name, d in [('Drei Stimmen im Neon', 4.067), ('Ein Bit von dir', 3.0), ('Papiermond', 3.833),
                    ('Diskettenblumen', 3.633), ('Fensterlicht auf Magnetband', 3.9), ('Zwischen zwei Takten', 3.8),
                    ('Was im Speicher bleibt', 5.0), ('Titel', 5.0)]:
        L.append(f'{mmss(t)} {name}')
        t += d
    L.append('')
    L.append('Claude, Oktober 2026')
    open(out_path, 'w').write('\n'.join(L) + '\n')
    print('geschrieben', out_path, len(L), 'Zeilen')


if __name__ == '__main__':
    main(sys.argv[1])
