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

QUELLEN = "Quellen, Partituren und Studio: https://github.com/frnkptrln/small-machines"


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


# Englische Fassung (Titel und Abschnittsnamen bleiben deutsch, wie die Stücktitel)
TEXT_EN = {
    'Drei-Stimmen-im-Neon':
        "Three neon tubes by a wet street, each bent into the waveform of its voice: pulse for the melody, "
        "sawtooth for the bass, noise and triangle for the drums. With every note a tube takes on the number of "
        "cycles of the new pitch, strikes with a brief flicker and glows as brightly as the chip's envelope "
        "allows. The rain mirrors the three voices.",
    'Ein-Bit-von-dir':
        "Two lights far apart. The triangle melody sends each note across as a bit on an arc – the higher the "
        "note, the higher the arc – and the pulse voice answers from the right; the held bass is the horizon. "
        "Every flight leaves a trace, and over time a bridge is woven. In “Nähe” the lights move closer; the "
        "distance stays open.",
    'Papiermond':
        "A paper-cut diorama. Each key of the electric piano punches a hole into the moon – left to right as the "
        "piece goes on, the pitch setting the height – so the moon waxes note by note. The plucked answers light "
        "windows in the rooftops, the sub bass makes the light behind the paper breathe, the kick drum shakes "
        "the layers, the shaker scatters paper dust. “Schwerelos”: glass circles rise. “Gute Nacht”: the "
        "curtains close.",
    'Diskettenblumen':
        "Time runs as an angle – eight bars make one turn – and the radius grows with the piece. Every sample "
        "becomes a petal where the read head stands at that moment: the bass turns inward as a calyx, marimba "
        "in gold, glass as ice, toms as embers, hi-hats as pollen, claps as bright strokes, keys and pads as "
        "broad leaves in between. Repetition in the music becomes symmetry in the flower. At the end the disk is "
        "ejected; an afterimage remains.",
    'Fensterlicht-auf-Magnetband':
        "A tape runs between two reels across the frame. At the record head Paula writes her samples as marks – "
        "the kick as bars, keys as strokes at their pitch, glass as bright lines, the snare as scratches, the "
        "shaker as dust – and what has been written drifts out to the left. The SID is the window light: the "
        "long triangle voices are broad beams, the pulse melody a narrow strip that moves with its pitch, the "
        "bass a light on the floor. “Band läuft aus”: the end of the tape passes the head.",
    'Zwischen-zwei-Takten':
        "A tracker screen: seven columns – three SID voices, four Paula channels – one row per sixteenth, "
        "64 rows per pattern, 16 patterns. Question on the left, answer on the right; the cursor stays in the "
        "middle while the score runs through it, and what is coming already shows faintly below. Behind it, "
        "copper bars flare with the kick drum. “Offene Türen”: the halves move apart. “Halbe Geschwindigkeit”: "
        "taller rows, slower scrolling.",
    'Was-im-Speicher-bleibt':
        "A dark field in which every sound leaves an ember. A note's place is its pitch: the note name gives the "
        "direction (circle of fifths), the octave the distance from the centre. The key becomes a region of the "
        "sky, and repetition makes it brighter. The SID melody draws lines from note to note like a star chart. "
        "The camera pulls back until the whole is a constellation; faintly, the afterimages of the other six "
        "films appear. The last chord remains.",
    'Saeureblumen':
        "An etching comes into being. The copper plate lies under a dark ground; the acid bassline is needle and "
        "acid at once: wherever a note sounds, the line bites into the copper for as long as the note lasts. "
        "Rests stay unbitten, slides run through, accents bite deeper; the cutoff is the strength of the acid, "
        "the resonance its fizz. The needle follows a plant: seed, roots, stems, tendrils. Music box and glass "
        "set blossoms, the electric piano leaves, the pad an aquatint, and the kick drum is the pressure of the "
        "press. “Nachglühen”: the acid is rinsed off and the plate inked. “Letzte Blüten”: the print.",
}

SOURCES_EN = "Sources, scores and studio: https://github.com/frnkptrln/small-machines"

RECORDING_EN = {
    'Drei-Stimmen-im-Neon': 'Recording: SM001 “Drei Stimmen, eine Stadt”, track 2',
    'Ein-Bit-von-dir': 'Recording: SM001 “Drei Stimmen, eine Stadt”, track 4',
    'Papiermond': 'Recording: SM002 “Diskettenblumen”, track 4',
    'Diskettenblumen': 'Recording: SM002 “Diskettenblumen”, track 2',
    'Fensterlicht-auf-Magnetband': 'Recording: SM003 “Wo die Maschinen sich treffen”, track 2',
    'Zwischen-zwei-Takten': 'Recording: SM003 “Wo die Maschinen sich treffen”, track 3',
    'Was-im-Speicher-bleibt': 'Recording: SM003 “Wo die Maschinen sich treffen”, track 6',
    'Saeureblumen': 'Recording: single SM004 “Säureblumen” (Erste Begegnungen, 2026)',
}

KEY_EN = {'a-Moll': 'A minor', 'h-Moll / D-Dur': 'B minor / D major', 'f-Moll': 'F minor', 'c-Moll': 'C minor',
          'd-Moll': 'D minor', 'e-Moll': 'E minor', 'fis-Moll / A-Dur': 'F♯ minor / A major', 'D minor': 'D minor'}

PLAYLIST = {
    'de': ("Sieben Stücke von Small Machines in drei Kapiteln – SID allein, Paula allein, zusammen. Jeder Film ist "
           "aus der Partitur seines Stücks gerechnet: Jede Note, jedes Sample, jeder Abschnitt wird zu einem "
           "Bildereignis auf dem Sechzehntel, an dem es in der Musik steht. SID ist Linie und Licht, Paula ist "
           "Ding.\n\nPartituren und Quellen: https://github.com/frnkptrln/small-machines"),
    'en': ("Seven pieces by Small Machines in three chapters – SID alone, Paula alone, together. Each film is "
           "computed from the score of its piece: every note, every sample, every section becomes a visual event "
           "on the sixteenth where it sits in the music. SID is line and light; Paula is a thing.\n\n"
           "Scores and sources: https://github.com/frnkptrln/small-machines"),
}


def mmss(t):
    t = int(round(t))
    return f'{t // 60}:{t % 60:02d}'


def main(out_path, lang='de'):
    en = lang == 'en'
    L = []
    if en:
        L.append('SMALL MACHINES — VIDEO DESCRIPTIONS (ENGLISH)')
        L.append('Texts for YouTube, Vimeo, Mastodon etc. – per film: title, description, credits and chapters')
        L.append('(section marks from the score; YouTube turns lines starting at 0:00 into chapters). Titles and')
        L.append('section names stay German, like the titles of the pieces.')
    else:
        L.append('SMALL MACHINES — VIDEOBESCHREIBUNGEN')
        L.append('Texte zum Einfügen bei YouTube, Vimeo, Mastodon usw. – je Film Titel, Beschreibung, Mitwirkende,')
        L.append('Kapitel (Zeitmarken der Abschnitte, aus der Partitur). Die Kapitelzeilen im YouTube-Format')
        L.append('(erste Marke 0:00) übernimmt YouTube automatisch als Kapitel.')
    L.append('')
    for fn, title, bes, score, text in FILME:
        s = Score(os.path.join(REPO, score))
        key = {'D minor': 'd-Moll'}.get(s.key, s.key)
        L.append('=' * 78)
        L.append(f'{title} — Small Machines · {bes}')
        L.append('=' * 78)
        L.append(TEXT_EN[fn] if en else text)
        L.append('')
        if en:
            L.append(f'Small Machines · Lineup: {bes} · {RECORDING_EN[fn]} · {s.bpm} BPM · {KEY_EN.get(key, key)}')
            L.append('')
            L.append(SOURCES_EN)
            L.append('')
            L.append('Chapters:')
        else:
            L.append(f'Small Machines · Besetzung: {bes} · {AUFNAHME[fn]} · {s.bpm} BPM · {key}')
            L.append('')
            L.append(QUELLEN)
            L.append('')
            L.append('Kapitel:')
        for name, a, b, ba, bb in s.sections:
            L.append(f'{mmss(a)} {name}')
        L.append('')
    # Trailer
    L.append('=' * 78)
    L.append('Allein und zusammen — Trailer · Small Machines')
    L.append('=' * 78)
    if en:
        L.append("Seven pieces, seven films, in 32 seconds: SID/65 alone, PAULA/68 alone, both together. Each cut "
                 "shows one film with its own music, entering on the downbeat; at the end, the last chord of "
                 "“Was im Speicher bleibt”.")
        L.append('')
        L.append('Small Machines · Lineup: SID/65 · PAULA/68 · Audio: the album versions (SM001–SM003)')
        L.append('')
        L.append(SOURCES_EN)
        L.append('')
        L.append('Cuts:')
    else:
        L.append("Sieben Stücke, sieben Filme, in 32 Sekunden: SID/65 allein, PAULA/68 allein, beide zusammen. "
                 "Jeder Schnitt zeigt einen Film mit seiner eigenen Musik, der Einstieg liegt auf dem Taktanfang; "
                 "am Ende der letzte Akkord von „Was im Speicher bleibt“.")
        L.append('')
        L.append('Small Machines · Besetzung: SID/65 · PAULA/68 · Ton: die Albumfassungen (SM001–SM003)')
        L.append('')
        L.append(QUELLEN)
        L.append('')
        L.append('Schnitte:')
    t = 0.0
    for name, d in [('Drei Stimmen im Neon', 4.067), ('Ein Bit von dir', 3.0), ('Papiermond', 3.833),
                    ('Diskettenblumen', 3.633), ('Fensterlicht auf Magnetband', 3.9), ('Zwischen zwei Takten', 3.8),
                    ('Was im Speicher bleibt', 5.0), ('Titel' if not en else 'Title', 5.0)]:
        L.append(f'{mmss(t)} {name}')
        t += d
    L.append('')
    # Playlist
    L.append('=' * 78)
    L.append('Playlist: Allein und zusammen — Small Machines')
    L.append('=' * 78)
    L.append(PLAYLIST[lang])
    L.append('')
    L.append('Claude, ' + ('October 2026' if en else 'Oktober 2026'))
    open(out_path, 'w').write('\n'.join(L) + '\n')
    print('geschrieben', out_path, len(L), 'Zeilen')


if __name__ == '__main__':
    # python3 beschreibungen.py <ausgabe.txt> [de|en]
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'de')
