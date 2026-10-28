#!/usr/bin/env python3
"""
Small Machines — Trailer „Allein und zusammen".

Sieben Schnitte, je ein Film als eine Form mit seiner eigenen Musik, harte Schnitte
auf den Taktanfang, am Ende die Titelkarte. Die Bilder werden – wie die Filme –
aus den Partituren gerechnet (ohne die Kapitelmarken der Filme), die Tonspur wird
aus den Albumfassungen geschnitten (<ID>.wav aus music/albums/SM001-003, z. B. SID-02.wav):
Einstieg exakt auf dem Taktanfang, Länge in ganzen bzw. halben Takten.

  python trailer.py render  <out_video.mp4>         Bild (ohne Ton)
  python trailer.py audio   <out_audio_cmd.sh> DIR  ffmpeg-Befehl für die Tonspur
  python trailer.py probe   <dir>                   Kandidatenbilder
  python trailer.py plan                            Schnittliste ausgeben
"""
import os, sys, math, json, importlib
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import Score, Post, Canvas, Caption, VideoOut, hexc, font, smooth, fade_window

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from render import REPO, SCORES
INK = hexc('#d9c9a8')
BG = hexc('#06070c')

# key, modul, klasse, partitur, audio (Dateistamm), takt_ein, takte, maschine, titel
SHOTS = [
    dict(key='neon', mod='film_neon', cls='Neon', score=SCORES['neon'],
         audio='SID-02', bar=24, bars=2.0, machine='SID/65', title='Drei Stimmen im Neon'),
    dict(key='bit', mod='film_bit', cls='Bit', score=SCORES['bit'],
         audio='SID-04', bar=34, bars=1.0, machine='SID/65', title='Ein Bit von dir'),
    dict(key='papiermond', mod='film_papiermond', cls='Papiermond', score=SCORES['papiermond'],
         audio='PAULA-04', bar=40, bars=1.5, machine='PAULA/68', title='Papiermond'),
    dict(key='disk', mod='film_diskettenblumen', cls='Diskettenblumen', score=SCORES['diskettenblumen'],
         audio='PAULA-02', bar=52, bars=2.0, machine='PAULA/68', title='Diskettenblumen'),
    dict(key='band', mod='film_magnetband', cls='Magnetband', score=SCORES['magnetband'],
         audio='DUO-02', bar=44, bars=1.5, machine='SID/65 + PAULA/68', title='Fensterlicht auf Magnetband'),
    dict(key='takte', mod='film_takte', cls='Takte', score=SCORES['takte'],
         audio='DUO-03', bar=22, bars=2.0, machine='SID/65 + PAULA/68', title='Zwischen zwei Takten'),
    dict(key='speicher', mod='film_speicher', cls='Speicher', score=SCORES['speicher'],
         audio='DUO-06', bar=46, bars=1.5, machine='SID/65 + PAULA/68', title='Was im Speicher bleibt',
         last=True),
]
TITLE_SECONDS = 5.0      # Titelkarte
TAIL_FADE = 2.2          # Ton-Ausblendung unter der Titelkarte
CAPTION_IN = 0.22        # Einblendzeit der Beschriftung (s)


class NoCaption:
    """Schluckt die Beschriftungen der Filme (Titel, Kapitelmarken, Abspann)."""
    def __getattr__(self, name):
        return lambda *a, **k: None


def shot_times(sh, fps):
    s = Score(os.path.join(REPO, sh['score']))
    bar_s = 240.0 / s.bpm
    t_in = sh['bar'] * bar_s
    n = int(round(sh['bars'] * bar_s * fps))
    return s, t_in, n


def plan(fps=30):
    rows, t = [], 0.0
    for sh in SHOTS:
        s, t_in, n = shot_times(sh, fps)
        d = n / fps
        rows.append((sh['key'], s.bpm, sh['bar'], sh['bars'], round(t_in, 3), n, round(d, 3), round(t, 3)))
        t += d
    return rows, t


def caption(cv, cap, sh, t_since, W, H):
    a = smooth(min(t_since / CAPTION_IN, 1.0))
    if a <= 0:
        return
    x, y = int(W * 0.052), int(H * 0.905)
    cv.text(sh['machine'], (x, y), cap.f_tiny, INK, alpha=0.55 * a, anchor='ls', tracking=3)
    cv.text(sh['title'].upper(), (x, y + int(H * 0.034)), cap.f_small, INK, alpha=0.85 * a, anchor='ls', tracking=5)


def title_card(cv, cap, t, dur, W, H):
    a = fade_window(t, 0.45, dur, 0.9)
    if a <= 0:
        return
    y0 = 0.385
    lines = [('SMALL MACHINES', 'small', y0), ('Allein und zusammen', 'title', y0 + 0.075),
             ('SIEBEN STÜCKE  ·  SIEBEN FILME', 'small', y0 + 0.13),
             ('SID/65  ·  PAULA/68', 'small', y0 + 0.225),
             ('Berlin, Oktober 2026', 'small', y0 + 0.267)]
    for txt, kind, yr in lines:
        f = cap.f_title if kind == 'title' else cap.f_tiny
        cv.text(txt, (W / 2, int(H * yr)), f, INK, alpha=(0.92 if kind == 'title' else 0.55) * a, anchor='ms',
                tracking=1 if kind == 'title' else 3)


def make_film(sh, W, H, fps):
    s = Score(os.path.join(REPO, sh['score']))
    film_cls = getattr(importlib.import_module(sh['mod']), sh['cls'])
    film = film_cls(s, W, H, fps)
    film.cap = NoCaption()
    if sh['key'] == 'takte':
        # Die Fußzeile des Trackers (PATTERN/ROW/BPM, Abschnittsname, Linie bei 0.93 H)
        # weicht im Trailer der Beschriftung des Schnitts.
        _put, _stroke = film.put, film.canvas.stroke
        def put(tok, x, y, color, alpha, glow=0.0, small=False):
            if tok.startswith('PATTERN ') or tok.startswith('; '):
                return
            _put(tok, x, y, color, alpha, glow, small)
        def stroke(pts, color, width=1.0, alpha=1.0, closed=False, layer=None):
            if len(pts) == 2 and abs(pts[0][1] - H * 0.93) < 1e-6 and abs(pts[1][1] - H * 0.93) < 1e-6:
                return
            _stroke(pts, color, width, alpha, closed, layer)
        film.put, film.canvas.stroke = put, stroke
    post = Post(W, H, **film.post_params())
    return s, film, post


def render(out_path, W=1920, H=1080, fps=30, crf=18, preset='medium', only=None):
    cap = Caption(W, H, scale=H / 1080)
    vo = VideoOut(out_path, W, H, fps, crf=crf, preset=preset)
    gi = 0
    for sh in SHOTS:
        if only and sh['key'] not in only:
            continue
        s, film, post = make_film(sh, W, H, fps)
        bar_s = 240.0 / s.bpm
        t_in = sh['bar'] * bar_s
        n = int(round(sh['bars'] * bar_s * fps))
        film.warmup(t_in, fps)
        for j in range(n):
            t = t_in + j / fps
            film.canvas.clear()
            fade = film.frame(t, gi)
            caption(film.canvas, cap, sh, j / fps, W, H)
            vo.write(post.render(film.canvas, gi, fade))
            gi += 1
        print(f"{sh['key']}: {n} Bilder ab {t_in:.3f}s", flush=True)
        del film, post
    # Titelkarte
    cv = Canvas(W, H, BG)
    post = Post(W, H)
    n_t = int(round(TITLE_SECONDS * fps))
    for j in range(n_t):
        cv.clear()
        title_card(cv, cap, j / fps, TITLE_SECONDS, W, H)
        vo.write(post.render(cv, gi, 1.0))
        gi += 1
    vo.close()
    print('Bilder gesamt', gi, 'Dauer', gi / fps)


def audio_cmd(audio_dir, ext, out_path, fps=30, codec='aac -b:a 256k', video=None, meta=False):
    """ffmpeg-Befehl: Segmente exakt so lang wie die Bildfolgen, harte Schnitte (4 ms Flanken).
    Mit video=<Datei> wird die Bildspur unverändert dazugemuxt (ein Durchgang)."""
    inputs, filt, labels = [], [], []
    off = 1 if video else 0
    if video:
        inputs += ['-i', video]
    for k, sh in enumerate(SHOTS):
        s, t_in, n = shot_times(sh, fps)
        d = n / fps
        if sh.get('last'):
            d += TITLE_SECONDS
        inputs += ['-i', os.path.join(audio_dir, sh['audio'] + ext)]
        f = f"[{k + off}:a]atrim=start={t_in:.6f}:duration={d:.6f},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.004"
        if sh.get('last'):
            f += f",afade=t=out:st={d - TAIL_FADE:.6f}:d={TAIL_FADE:.3f}"
        else:
            f += f",afade=t=out:st={d - 0.004:.6f}:d=0.004"
        f += f"[a{k}]"
        filt.append(f)
        labels.append(f"[a{k}]")
    filt.append(''.join(labels) + f"concat=n={len(SHOTS)}:v=0:a=1[out]")
    cmd = ['ffmpeg', '-y', '-v', 'error'] + inputs + ['-filter_complex', '"' + ';'.join(filt) + '"']
    if video:
        cmd += ['-map', '0:v:0', '-c:v', 'copy']
    cmd += ['-map', '"[out]"', '-c:a'] + codec.split() + ['-ar', '44100']
    if meta:
        cmd += ['-metadata', 'title="Allein und zusammen — Trailer"', '-metadata', 'artist="Small Machines"',
                '-metadata', 'album="Small Machines — Allein und zusammen · Filme"', '-metadata', 'date=2026',
                '-metadata', 'comment="Musik: Small Machines (Frank + ChatGPT) · Bild: Frank + Claude · '
                             'sieben Schnitte aus den sieben Filmen, aus der Partitur gerechnet"',
                '-movflags', '+faststart']
    cmd += [out_path]
    return ' '.join(cmd)


def probe(out_dir, W=1920, H=1080, fps=30, candidates=None):
    """Kandidaten: je Film mehrere Taktpositionen, vier Bilder über die Schnittlänge."""
    os.makedirs(out_dir, exist_ok=True)
    cap = Caption(W, H, scale=H / 1080)
    for sh in SHOTS:
        bars = candidates.get(sh['key'], [sh['bar']]) if candidates else [sh['bar']]
        s, film, post = make_film(sh, W, H, fps)
        bar_s = 240.0 / s.bpm
        rows = []
        for b in bars:
            t_in = b * bar_s
            dur = sh['bars'] * bar_s
            film.warmup(t_in, fps)
            tiles = []
            for q in range(4):
                t = t_in + dur * q / 3.0 * 0.999
                film.canvas.clear()
                fade = film.frame(t, int(t * fps))
                caption(film.canvas, cap, sh, t - t_in, W, H)
                rgb = post.render(film.canvas, int(t * fps), fade)
                tiles.append(Image.fromarray(rgb).resize((W // 4, H // 4), Image.LANCZOS))
            strip = Image.new('RGB', (W, H // 4))
            for q, im in enumerate(tiles):
                strip.paste(im, (q * (W // 4), 0))
            rows.append((b, strip))
        sheet = Image.new('RGB', (W, (H // 4 + 6) * len(rows)), (20, 20, 20))
        for r, (b, strip) in enumerate(rows):
            sheet.paste(strip, (0, r * (H // 4 + 6)))
        sheet.save(os.path.join(out_dir, f"{sh['key']}.png"))
        print(sh['key'], 'bars', bars, flush=True)
        del film, post


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'plan':
        rows, total = plan()
        for r in rows:
            print(r)
        print('Schnitte gesamt', round(total, 3), 's  + Titel', TITLE_SECONDS, '=', round(total + TITLE_SECONDS, 3))
    elif cmd == 'render':
        kw = {}
        if '--preset' in sys.argv:
            kw['preset'] = sys.argv[sys.argv.index('--preset') + 1]
        if '--only' in sys.argv:
            kw['only'] = sys.argv[sys.argv.index('--only') + 1].split(',')
        render(sys.argv[2], **kw)
    elif cmd == 'audio':
        # audio <dir> <ext> <out> [video]   (mit video: Bildspur kopieren, Metadaten setzen)
        video = sys.argv[5] if len(sys.argv) > 5 else None
        print(audio_cmd(sys.argv[2], sys.argv[3], sys.argv[4], video=video, meta=bool(video)))
    elif cmd == 'probe':
        cands = json.loads(sys.argv[3]) if len(sys.argv) > 3 else None
        probe(sys.argv[2], candidates=cands)
