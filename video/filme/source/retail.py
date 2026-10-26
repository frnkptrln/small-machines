#!/usr/bin/env python3
"""
Abspann neu: nur das Ende eines Films neu rechnen und an den vorhandenen Master ansetzen.

  python retail.py <film> <score.json> <master_video.mp4> <workdir> <preset> [t_cut_max]

Sucht das letzte Keyframe des Masters vor t_cut_max (Standard: Musikende − 0.5 s), rendert
ab dort neu (gleiche Encoder-Einstellungen wie der Master), prüft Bildzahl und SPS/PPS, setzt
beide Teile zusammen (ffmpeg concat, ohne Neukodierung) und vergleicht Bilder um die Naht.
Schreibt <workdir>/<film>_tail.mp4 (Teil 2), <workdir>/<film>_spliced.mp4 und <workdir>/<film>.json.
"""
import os, sys, json, math, subprocess, importlib
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import Score, run_film
from render import FILMS


def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, check=True, **kw).stdout


def keyframes(path):
    out = sh(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,flags',
              '-of', 'csv=p=0', path])
    ks = []
    for line in out.splitlines():
        parts = line.split(',')
        if len(parts) >= 2 and 'K' in parts[1]:
            ks.append(float(parts[0]))
    return sorted(ks)


def nframes(path, count=False):
    if count:
        return int(sh(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
                       'stream=nb_read_frames', '-of', 'csv=p=0', path]).strip())
    return int(sh(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames',
                   '-of', 'csv=p=0', path]).strip())


def extradata(path):
    out = sh(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_streams', '-show_data', '-of', 'json', path])
    st = json.loads(out)['streams'][0]
    return st.get('extradata', '')


def frame_at(path, idx, W=1920, H=1080):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{idx / 30:.6f}', '-i', path, '-frames:v', '1',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(np.float32)


def psnr(a, b):
    mse = float(np.mean((a - b) ** 2))
    return 99.0 if mse == 0 else 10 * math.log10(255 ** 2 / mse)


def main():
    film, score_path, master, workdir, preset = sys.argv[1:6]
    fps = 30
    os.makedirs(workdir, exist_ok=True)
    s = Score(score_path)
    t_cut_max = float(sys.argv[6]) if len(sys.argv) > 6 else s.music_s - 0.5
    n_total = int(math.ceil(s.duration * fps))
    ks = keyframes(master)
    K = max(k for k in ks if k <= t_cut_max + 1e-6)
    Ki = int(round(K * fps))
    print(f'{film}: {len(ks)} Keyframes, Schnitt bei {K:.3f}s = Bild {Ki}, Rest {n_total - Ki} Bilder', flush=True)
    part1 = os.path.join(workdir, f'{film}_part1.mp4')
    tail = os.path.join(workdir, f'{film}_tail.mp4')
    spliced = os.path.join(workdir, f'{film}_spliced.mp4')
    # Teil 1: Master bis zum Keyframe, ohne Neukodierung
    sh(['ffmpeg', '-y', '-v', 'error', '-i', master, '-c:v', 'copy', '-an', '-frames:v', str(Ki), part1])
    n1 = nframes(part1)
    assert n1 == Ki, f'Teil 1 hat {n1} Bilder, erwartet {Ki}'
    # Teil 2: neu rechnen ab Bild Ki (gleiche Einstellungen wie der Master)
    mod, cls = FILMS[film]
    film_cls = getattr(importlib.import_module(mod), cls)
    run_film(film_cls, score_path, tail, W=1920, H=1080, fps=fps, frame_range=(Ki, n_total), crf=18, preset=preset)
    n2 = nframes(tail)
    assert n2 == n_total - Ki, f'Teil 2 hat {n2} Bilder, erwartet {n_total - Ki}'
    # SPS/PPS vergleichen
    ex1, ex2 = extradata(master), extradata(tail)
    same_sps = (ex1 == ex2)
    print('SPS/PPS gleich:', same_sps, flush=True)
    # zusammensetzen
    lst = os.path.join(workdir, f'{film}_concat.txt')
    open(lst, 'w').write(f"file '{os.path.abspath(part1)}'\nfile '{os.path.abspath(tail)}'\n")
    sh(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', spliced])
    n3 = nframes(spliced, count=True)
    assert n3 == n_total, f'Ganzes hat {n3} Bilder, erwartet {n_total}'
    # Naht prüfen: Bild Ki-1 identisch zum Master, Bild Ki und Ki+5 nahezu identisch (vor dem Abspann)
    rep = {}
    for idx, label in [(Ki - 1, 'vor_naht'), (Ki, 'naht'), (Ki + 5, 'naht+5'), (n_total - 1, 'letztes')]:
        a = frame_at(master, idx); b = frame_at(spliced, idx)
        rep[label] = round(psnr(a, b), 2)
    print('PSNR zum Master:', rep, flush=True)
    assert rep['vor_naht'] >= 99.0, 'Teil 1 nicht bitgleich'
    assert rep['naht'] > 40 and rep['naht+5'] > 40, 'Naht weicht zu stark ab'
    info = dict(film=film, K=K, Ki=Ki, n_total=n_total, n_tail=n2, preset=preset, same_sps=same_sps, psnr=rep,
                tail_md5=sh(['md5sum', tail]).split()[0], tail_bytes=os.path.getsize(tail))
    json.dump(info, open(os.path.join(workdir, f'{film}.json'), 'w'), indent=1)
    os.remove(part1)
    print(json.dumps(info), flush=True)


if __name__ == '__main__':
    main()
