#!/usr/bin/env python3
"""
Small Machines — Filme rendern.

  python3 render.py <film> [<partitur.json>] <bild.mp4> [--stills t1,t2 --stills-dir d] [--range a,b] [--preset p]
  python3 render.py memories          die sechs Nachbilder für „Was im Speicher bleibt" (video/filme/memories/)

Ohne Partitur wird die Partitur des Films aus dem Repository genommen (SCORES).
"""
import argparse, os, sys, importlib, shutil, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import run_film, Score

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
MEMORY_DIR = os.path.abspath(os.path.join(HERE, '..', 'memories'))

FILMS = {
    'diskettenblumen': ('film_diskettenblumen', 'Diskettenblumen'),
    'neon': ('film_neon', 'Neon'),
    'bit': ('film_bit', 'Bit'),
    'papiermond': ('film_papiermond', 'Papiermond'),
    'magnetband': ('film_magnetband', 'Magnetband'),
    'takte': ('film_takte', 'Takte'),
    'speicher': ('film_speicher', 'Speicher'),
    'saeureblumen': ('film_saeureblumen', 'Saeureblumen'),
}

# Partituren im Repository (byte-gleich mit den Paketen, aus denen die Filme gerechnet wurden)
EP = 'music/early/seven-pieces'
SCORES = {
    'neon': f'{EP}/Solo/scores/SID-01-Drei-Stimmen-im-Neon.json',
    'bit': f'{EP}/Solo/scores/SID-02-Ein-Bit-von-dir.json',
    'papiermond': f'{EP}/Solo/scores/PAULA-01-Papiermond.json',
    'diskettenblumen': f'{EP}/Solo/scores/PAULA-02-Diskettenblumen.json',
    'magnetband': f'{EP}/Duo/scores/01-Fensterlicht-auf-Magnetband.json',
    'takte': f'{EP}/Duo/scores/02-Zwischen-zwei-Takten.json',
    'speicher': f'{EP}/Duo/scores/03-Was-im-Speicher-bleibt.json',
    'saeureblumen': 'music/saeureblumen/scores/SM004-Saeureblumen.json',
}

# Nachbilder der anderen sechs Filme in „Was im Speicher bleibt": Film, Zeitpunkt (s), Dateiname
MEMORIES = [('neon', 52.0, '1-neon'), ('bit', 128.0, '2-bit'), ('papiermond', 118.0, '3-papiermond'),
            ('diskettenblumen', 112.0, '4-diskettenblumen'), ('magnetband', 100.0, '5-magnetband'),
            ('takte', 60.0, '6-takte')]


def film_class(film):
    mod, cls = FILMS[film]
    return getattr(importlib.import_module(mod), cls)


def make_memories(W=1920, H=1080, fps=30):
    os.makedirs(MEMORY_DIR, exist_ok=True)
    for film, t, name in MEMORIES:
        tmp = tempfile.mkdtemp()
        score = os.path.join(REPO, SCORES[film])
        run_film(film_class(film), score, None, W=W, H=H, fps=fps, stills=[t], stills_dir=tmp)
        sid = Score(score).id
        shutil.move(os.path.join(tmp, f'{sid}_{t:07.2f}.png'), os.path.join(MEMORY_DIR, f'{name}.png'))
        shutil.rmtree(tmp, ignore_errors=True)
        print('Nachbild', name, flush=True)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'memories':
        make_memories()
        return
    ap = argparse.ArgumentParser()
    ap.add_argument('film', choices=sorted(FILMS))
    ap.add_argument('paths', nargs='+', help='[partitur.json] bild.mp4')
    ap.add_argument('--stills', default=None)
    ap.add_argument('--stills-dir', default='stills')
    ap.add_argument('--range', default=None)
    ap.add_argument('--w', type=int, default=1920)
    ap.add_argument('--h', type=int, default=1080)
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--crf', type=int, default=18)
    ap.add_argument('--preset', default='medium')
    a = ap.parse_args()
    if len(a.paths) == 1:
        score, out = os.path.join(REPO, SCORES[a.film]), a.paths[0]
    elif len(a.paths) == 2:
        score, out = a.paths
    else:
        ap.error('erwartet: [partitur.json] bild.mp4')
    if a.film == 'speicher' and not os.path.isdir(MEMORY_DIR):
        print('Hinweis: video/filme/memories/ fehlt — zuerst „python3 render.py memories"', file=sys.stderr)
    stills = [float(x) for x in a.stills.split(',')] if a.stills else None
    rng = tuple(int(x) for x in a.range.split(',')) if a.range else None
    run_film(film_class(a.film), score, out, W=a.w, H=a.h, fps=a.fps, frame_range=rng, crf=a.crf,
             stills=stills, stills_dir=a.stills_dir, preset=a.preset)


if __name__ == '__main__':
    main()
