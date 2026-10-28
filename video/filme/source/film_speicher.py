"""
WAS IM SPEICHER BLEIBT — SID/65 + PAULA/68, 72 BPM, fis-Moll / A-Dur, 48 Takte.

Ein dunkles Feld. Jeder Klang hinterlässt eine Glut, und die Glut bleibt.
Der Ort einer Note ist ihre Tonhöhe: der Tonname gibt die Richtung (Quintenzirkel),
die Oktave den Abstand von der Mitte – so wird die Tonart des Stücks zu einer Gegend
am Himmel, und Wiederholung macht sie heller. Die Dreiecksmelodie des SID zieht Linien
von Note zu Note wie in einer Sternkarte; Bässe und Flächen sind der Kern, Glas und
Tasten die Sterne, Rim und Shaker Funken und Staub. Die Kamera zieht sich langsam zurück,
bis das Ganze ein Sternbild ist. Ganz schwach erscheinen am Ende die Nachbilder der
sechs anderen Filme. Der letzte Akkord bleibt stehen.
"""
import math, os, glob
import numpy as np
import cv2
from engine import Film, hexc, mix, smooth, ease_out, ease_in_out, env, fade_window
from film_neon import sid_env

TAU = 2 * math.pi
INK = hexc('#d9c9a8')
STAR = hexc('#fff4dc')
GLASS = hexc('#cfe9ff')
KEY = hexc('#ffd79a')
CORE = hexc('#b4622a')
PAD = hexc('#6f86a8')
CHOIR = hexc('#d2c0e8')
LINE = hexc('#c9b58f')
SPARK = hexc('#ffe2b0')
PC_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]  # Quintenzirkel
PC_INDEX = {pc: i for i, pc in enumerate(PC_ORDER)}

MEMORY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'memories')


class Speicher(Film):
    BG = '#040408'

    def __init__(self, score, W, H, fps):
        super().__init__(score, W, H, fps)
        s = self.score
        self.sec = {name: (a, b) for (name, a, b, _, _) in s.sections}
        self.F = 2048  # Feldraster
        self.field = np.zeros((self.F, self.F, 3), np.float32)
        self.fc = np.array([self.F / 2, self.F / 2])
        self.events = []
        rng = np.random.default_rng(3)
        prev_mel = None
        for n in s.notes:
            if n.sample == 'deep-kick':
                self.events.append(dict(n=n, kind='kick', t=n.start))
                continue
            P = self.pos(n.note, n.idx, H)
            e = dict(n=n, t=n.start, P=P, kind=n.sample if n.machine == 'paula' else f'sid{n.voice}')
            if n.machine == 'sid' and n.voice == 0:
                e['prev'] = prev_mel
                prev_mel = P
            if n.sample == 'shaker':
                r = np.random.default_rng(500 + n.idx)
                e['dust'] = [(self.fc + np.array([math.cos(a), math.sin(a)]) * rr) for a, rr in
                             zip(r.random(6) * TAU, (0.08 + 0.5 * r.random(6)) * H)]
            self.events.append(e)
        self.events.sort(key=lambda e: e['t'])
        self.ev_t = np.array([e['t'] for e in self.events])
        pts = np.array([e['P'] for e in self.events if 'P' in e and e['kind'] in ('glass', 'epiano', 'sid0', 'sid2', 'warm-pad')])
        self.vc = pts.mean(axis=0) * 0.8 + self.fc * 0.2  # Blickmitte: Schwerpunkt der Töne
        self.bake_ptr = 0
        self.memories = self.load_memories()

    def post_params(self):
        return dict(glow=(1.0, 0.8), sigmas=(5, 42), vignette=0.5, grain=0.012, exposure=1.0)

    # ---------------------------------------------------------------- Ort einer Note
    def pos(self, note, idx, H):
        r = np.random.default_rng(900 + (idx or 0))
        pc = note % 12
        octv = note // 12
        ang = PC_INDEX[pc] / 12 * TAU - math.pi / 2 + (r.random() - 0.5) * 0.14
        rad = (0.12 + 0.17 * (octv - 3)) * H + (r.random() - 0.5) * 0.05 * H
        rad = max(rad, 0.03 * H)
        return self.fc + np.array([math.cos(ang), math.sin(ang)]) * rad

    def load_memories(self):
        out = []
        for p in sorted(glob.glob(os.path.join(MEMORY_DIR, '*.png')))[:6]:
            img = cv2.imread(p, cv2.IMREAD_COLOR)
            if img is None:
                continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255
            img = np.where(img <= 0.04045, img / 12.92, ((img + 0.055) / 1.055) ** 2.4)
            w = int(self.W * 0.21); h = int(w * img.shape[0] / img.shape[1])
            img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
            ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
            m = (1 - np.clip(np.abs(xs / w - 0.5) * 2, 0, 1) ** 3) * (1 - np.clip(np.abs(ys / h - 0.5) * 2, 0, 1) ** 3)
            out.append((img, m[..., None].astype(np.float32)))
        return out

    # ---------------------------------------------------------------- Glut ins Feld backen
    def blob(self, P, sigma, color, gain):
        r = int(sigma * 3) + 1
        x0, y0 = int(P[0]) - r, int(P[1]) - r
        x1, y1 = x0 + 2 * r + 1, y0 + 2 * r + 1
        if x0 < 0 or y0 < 0 or x1 > self.F or y1 > self.F:
            return
        ys, xs = np.mgrid[0:2 * r + 1, 0:2 * r + 1]
        g = np.exp(-((xs - r - (P[0] - int(P[0]))) ** 2 + (ys - r - (P[1] - int(P[1]))) ** 2) / (2 * sigma * sigma)).astype(np.float32)
        self.field[y0:y1, x0:x1] += g[..., None] * (np.asarray(color, np.float32) * gain)

    def arc_pts(self, P0, P1, n=24):
        """leicht zur Mitte hin gebogene Verbindung"""
        P0 = np.asarray(P0, np.float64); P1 = np.asarray(P1, np.float64)
        mid = (P0 + P1) / 2
        C = mid + (self.fc - mid) * 0.22
        u = np.linspace(0, 1, n)[:, None]
        return (1 - u) ** 2 * P0 + 2 * (1 - u) * u * C + u ** 2 * P1

    def line(self, P0, P1, color, gain, width=1):
        pts = self.arc_pts(P0, P1)
        x0 = int(max(0, pts[:, 0].min() - 4)); y0 = int(max(0, pts[:, 1].min() - 4))
        x1 = int(min(self.F, pts[:, 0].max() + 5)); y1 = int(min(self.F, pts[:, 1].max() + 5))
        if x1 <= x0 or y1 <= y0:
            return
        layer = np.zeros((y1 - y0, x1 - x0), np.float32)
        p = np.round((pts - [x0, y0]) * 256).astype(np.int32).reshape(-1, 1, 2)
        cv2.polylines(layer, [p], False, 1.0, width, cv2.LINE_AA, shift=8)
        layer = cv2.GaussianBlur(layer, (0, 0), 1.0)
        self.field[y0:y1, x0:x1] += layer[..., None] * (np.asarray(color, np.float32) * gain)

    def bake_until(self, t):
        H = self.H
        while self.bake_ptr < len(self.events) and self.events[self.bake_ptr]['t'] <= t:
            e = self.events[self.bake_ptr]
            self.bake_ptr += 1
            n = e['n']
            k = e['kind']
            if k == 'kick':
                continue
            P = e['P']
            if k == 'glass':
                self.blob(P, 2.2 * H / 1080, GLASS, 0.55 * n.vel)
                self.blob(P, 9 * H / 1080, GLASS, 0.05 * n.vel)
            elif k == 'epiano':
                self.blob(P, 5 * H / 1080, KEY, 0.16 * n.vel)
            elif k == 'warm-pad':
                self.blob(P, 42 * H / 1080, PAD, 0.016)
            elif k == 'choir':
                self.blob(P, 60 * H / 1080, CHOIR, 0.014)
            elif k == 'music-box':
                self.blob(P, 1.8 * H / 1080, STAR, 0.8)
            elif k == 'rim':
                self.blob(P, 1.3 * H / 1080, SPARK, 0.5)
            elif k == 'shaker':
                for D in e['dust']:
                    self.blob(D, 1.2 * H / 1080, INK, 0.12)
            elif k == 'sid0':
                self.blob(P, 3.5 * H / 1080, STAR, 0.35)
                if e.get('prev') is not None:
                    self.line(e['prev'], P, LINE, 0.035)
            elif k == 'sid1':
                self.blob(P, 60 * H / 1080, CORE, 0.011)
            elif k == 'sid2':
                self.blob(P, 30 * H / 1080, KEY, 0.02)

    def warmup(self, t, fps):
        self.bake_until(t)

    # ---------------------------------------------------------------- Bild
    def camera(self, t):
        s = self.score
        p = min(max(t / s.music_s, 0.0), 1.0)
        a, b = self.sec['Alles wird weit']
        wide = smooth(min(max((t - a) / (b - a), 0.0), 1.0)) if t > a else 0.0
        k = 1.45 - 0.45 * ease_in_out(p) - 0.22 * wide
        rot = 0.012 * t * (1 - 0.5 * wide)  # sehr langsame Drehung (rad)
        return k, rot

    def frame(self, t, i):
        s, cv = self.score, self.canvas
        W, H = self.W, self.H
        self.bake_until(t)
        k, rot = self.camera(t)
        # Puls der Bassdrum
        pulse = 0.0
        j = int(np.searchsorted(self.ev_t, t, side='right'))
        for e in self.events[max(0, j - 30):j]:
            if e['kind'] == 'kick' and t - e['t'] < 1.5:
                pulse += env(t, e['t'], 0.03, 0.5) * e['n'].vel
        a_b, b_b = self.sec['Bleibt']
        bleibt = smooth(min(max((t - a_b) / 6.0, 0.0), 1.0)) if t > a_b else 0.0
        gain = (0.85 + 0.25 * pulse + 0.35 * bleibt)
        # Feld in die Kamera transformieren
        c, sn = math.cos(rot) * k, math.sin(rot) * k
        tx = W / 2 - (c * self.vc[0] - sn * self.vc[1])
        ty = H / 2 - (sn * self.vc[0] + c * self.vc[1])
        M = np.array([[c, -sn, tx], [sn, c, ty]], np.float64)
        warped = cv2.warpAffine(self.field, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        cv.emit += warped * gain

        # Frische Klänge leuchten
        def to_screen(P):
            x = c * P[0] - sn * P[1] + tx
            y = sn * P[0] + c * P[1] + ty
            return np.array([x, y])
        vdef = s.voices_def
        for e in self.events[max(0, j - 60):j]:
            n = e['n']
            kind = e['kind']
            age = t - e['t']
            if kind == 'kick':
                if age < 1.2:
                    r = (0.05 + 0.9 * ease_out(age / 1.2, 1.5)) * H * k
                    cv.glow_circle((W / 2, H / 2), r, CORE * (0.25 * (1 - age / 1.2) ** 2 * n.vel), width=1.5)
                continue
            Q = to_screen(e['P'])
            if kind.startswith('sid'):
                lv = sid_env(t, n, vdef[n.voice])
                if lv <= 0.003:
                    continue
                if kind == 'sid0':
                    cv.glow_point(Q, STAR * (2.2 * lv), size=4 * H / 1080 * k)
                    if e.get('prev') is not None:
                        u = ease_out(min(1.0, age / max(0.3, n.dur)), 1.5)
                        arc = self.arc_pts(e['prev'], e['P'])
                        m = max(2, int(len(arc) * u))
                        cv.glow_line([to_screen(q) for q in arc[:m]], LINE * (0.35 * lv), width=1.2)
                elif kind == 'sid1':
                    cv.glow_point(Q, CORE * (0.9 * lv), size=90 * H / 1080 * k)
                else:
                    cv.glow_point(Q, KEY * (0.5 * lv), size=40 * H / 1080 * k)
            else:
                dec = {'glass': 1.8, 'epiano': 1.4, 'warm-pad': 3.0, 'choir': 3.5, 'music-box': 1.0, 'rim': 0.3, 'shaker': 0.4}.get(kind, 0.8)
                a = env(t, e['t'], 0.02, dec) * n.vel
                if a <= 0.004:
                    continue
                if kind == 'glass':
                    cv.glow_point(Q, GLASS * (2.6 * a), size=3 * H / 1080 * k)
                    cv.glow_point(Q, GLASS * (0.5 * a), size=12 * H / 1080 * k)
                elif kind == 'epiano':
                    cv.glow_point(Q, KEY * (1.4 * a), size=7 * H / 1080 * k)
                elif kind == 'warm-pad':
                    cv.glow_point(Q, PAD * (0.35 * a), size=60 * H / 1080 * k)
                elif kind == 'choir':
                    cv.glow_point(Q, CHOIR * (0.3 * a), size=80 * H / 1080 * k)
                elif kind == 'music-box':
                    cv.glow_point(Q, STAR * (3.0 * a), size=2.5 * H / 1080 * k)
                    for ang in (0, math.pi / 2):
                        v = np.array([math.cos(ang), math.sin(ang)]) * 18 * H / 1080 * k
                        cv.glow_line([Q - v, Q + v], STAR * (0.8 * a), width=1.0)
                elif kind == 'rim':
                    cv.glow_point(Q, SPARK * (2.5 * a), size=1.8 * H / 1080 * k)
                elif kind == 'shaker':
                    for D in e['dust']:
                        cv.glow_point(to_screen(D), INK * (0.6 * a), size=1.3 * H / 1080 * k)

        # Nachbilder der anderen Filme (sehr schwach), ab „Alles wird weit"
        a_w, b_w = self.sec['Alles wird weit']
        if self.memories and t > a_w + 2:
            slots = [(0.10, 0.14), (0.76, 0.12), (0.06, 0.70), (0.80, 0.72), (0.42, 0.04), (0.42, 0.84)]
            for q, (img, m) in enumerate(self.memories):
                ta = a_w + 2 + q * 3.5
                al = smooth(min(max((t - ta) / 6.0, 0.0), 1.0)) * (0.09 + 0.06 * bleibt)
                if al <= 0:
                    continue
                h, w = img.shape[:2]
                x0 = int(W * slots[q][0]); y0 = int(H * slots[q][1])
                x1, y1 = min(W, x0 + w), min(H, y0 + h)
                sub = cv.base[y0:y1, x0:x1]
                sub += (img[:y1 - y0, :x1 - x0] * m[:y1 - y0, :x1 - x0]) * al

        # Schrift
        self.cap.title(cv, 'SMALL MACHINES  ·  SID/65 + PAULA/68', 'Was im Speicher bleibt',
                       f'{s.bpm} BPM  ·  {s.key}  ·  drei Stimmen, vier Kanäle', t, INK, dur=9.0, y_rel=0.13)
        for jx, (name, a, b, _, _) in enumerate(s.sections):
            if jx == 0:
                continue
            self.cap.section(cv, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][jx], name, t - a, INK)
        if t > s.music_s + 1.0:
            self.cap.credits(cv, [('Was im Speicher bleibt', 'title'),
                                  ('Small Machines', 'name'),
                                  ('SID/65 × PAULA/68', 'small'),
                                  ('Allein und zusammen  ·  sieben Filme  ·  Berlin, Oktober 2026', 'small')], t - (s.music_s + 1.0), INK, dur=s.tail - 1.3)
        return self.master_fade(t) if t < 2.5 else 1.0 if t < s.duration - 1.5 else max(0.0, (s.duration - t) / 1.5)
