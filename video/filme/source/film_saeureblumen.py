"""
SÄUREBLUMEN — ACID/16 × PAULA/68, 124 BPM, d-Moll, 96 Takte.

Eine Radierung entsteht. Die Kupferplatte liegt unter dunklem Ätzgrund; die Acid-Bassline
ist die Nadel und zugleich die Säure: Wo eine Note klingt, beißt sich die Linie ins Kupfer
– solange die Note dauert. Pausen bleiben ungeätzt, Slides laufen durch, Akzente beißen
tiefer. Der Cutoff des Filters ist die Stärke der Säure (Breite und Helligkeit der Linie),
die Resonanz ihr Brodeln. Die Nadel folgt einer Pflanze: Samen, Wurzeln, Stängel, ein
zweiter Stängel als Antwort des Gartens, Ranken. Die Spieluhr und das Glas setzen Blüten
(jede Note ein Blatt, die Tonhöhe gibt die Richtung), das E-Piano die Blätter, die Fläche
legt Aquatinta-Schraffur, Hats und Snare punktieren und schraffieren, die Bassdrum ist der
Druck der Presse.
„Nachglühen": die Säure wird abgespült, die Platte eingefärbt und gewischt – die Linien
werden schwarz. „Letzte Blüten": der Abzug. Das Papier legt sich über die Platte, und was
zwei Minuten lang als Negativ im Kupfer glühte, steht als Druck auf dem Blatt.
"""
import math
import numpy as np
import cv2
from engine import Film, hexc, mix, smooth, ease_out, ease_in_out, env, fade_window, font, SUB, SHIFT

TAU = 2 * math.pi
INK = hexc('#d9c9a8')
TABLE = hexc('#0a0908')
GROUND = hexc('#15100b')      # Ätzgrund (Wachs) – fast schwarz, warm
COPPER = hexc('#3a2113')      # Platte unter dem Grund, gewischt
COPPER_HI = hexc('#8a5330')   # Glanzlicht der Platte
BITE = hexc('#cf7a36')        # frisch freigelegtes Kupfer in der Rille
BITE_DEEP = hexc('#ffc890')
FIZZ = hexc('#5fd8b4')        # Säure brodelt (Kupfergrün)
FIZZ_CORE = hexc('#eafff6')
INK_BLACK = hexc('#120e0b')
PAPER = hexc('#efe5cc')
PAPER_SHADE = hexc('#d9cdb0')
PENCIL = hexc('#5a5048')


def bezier(pts, n=60):
    """kubische/quadratische Bézier-Kurve (Liste von 3 oder 4 Punkten) -> Polylinie"""
    P = np.asarray(pts, np.float64)
    u = np.linspace(0, 1, n)[:, None]
    if len(P) == 4:
        return (1 - u) ** 3 * P[0] + 3 * (1 - u) ** 2 * u * P[1] + 3 * (1 - u) * u ** 2 * P[2] + u ** 3 * P[3]
    return (1 - u) ** 2 * P[0] + 2 * (1 - u) * u * P[1] + u ** 2 * P[2]


def spiral(c, r0, r1, turns, n=120, phase=0.0, cw=1):
    u = np.linspace(0, 1, n)
    th = phase + cw * TAU * turns * u
    r = r0 + (r1 - r0) * u
    return np.stack([c[0] + r * np.cos(th), c[1] + r * np.sin(th)], axis=1)


def rose(c, R, k, n=240, phase=0.0):
    th = np.linspace(0, TAU, n)
    r = R * np.abs(np.cos(k * th / 2)) if k % 2 == 0 else R * np.cos(k * th)
    r = np.abs(r)
    return np.stack([c[0] + r * np.cos(th + phase), c[1] + r * np.sin(th + phase)], axis=1)


class Path:
    """Polylinie mit Bogenlängen-Parametrisierung"""
    def __init__(self, pts):
        self.p = np.asarray(pts, np.float64)
        d = np.linalg.norm(np.diff(self.p, axis=0), axis=1)
        self.s = np.concatenate([[0], np.cumsum(d)])
        self.L = self.s[-1]

    def at(self, f):
        s = min(max(f, 0.0), 1.0) * self.L
        i = int(np.searchsorted(self.s, s, side='right')) - 1
        i = min(max(i, 0), len(self.p) - 2)
        seg = self.s[i + 1] - self.s[i]
        u = (s - self.s[i]) / seg if seg > 0 else 0
        return self.p[i] * (1 - u) + self.p[i + 1] * u

    def heading(self, f):
        a = self.at(max(0.0, f - 0.01)); b = self.at(min(1.0, f + 0.01))
        v = b - a
        return math.atan2(v[1], v[0]) if np.linalg.norm(v) > 1e-9 else 0.0

    def between(self, f0, f1):
        """Teilstück als Punktliste"""
        f0, f1 = min(max(f0, 0.0), 1.0), min(max(f1, 0.0), 1.0)
        if f1 <= f0:
            return np.array([self.at(f0), self.at(f0)])
        s0, s1 = f0 * self.L, f1 * self.L
        i0 = int(np.searchsorted(self.s, s0, side='right'))
        i1 = int(np.searchsorted(self.s, s1, side='left'))
        mid = self.p[i0:i1]
        return np.vstack([self.at(f0)[None], mid, self.at(f1)[None]])


class Saeureblumen(Film):
    BG = '#0a0908'

    def __init__(self, score, W, H, fps):
        super().__init__(score, W, H, fps)
        s = self.score
        self.sec = {name: (a, b) for (name, a, b, _, _) in s.sections}
        # Platte und Blatt
        self.px0, self.px1 = int(W * 0.13), int(W * 0.87)
        self.py0, self.py1 = int(H * 0.055), int(H * 0.855)
        self.pw, self.ph = self.px1 - self.px0, self.py1 - self.py0
        self.qx0, self.qx1 = int(W * 0.095), int(W * 0.905)
        self.qy0, self.qy1 = int(H * 0.02), int(H * 0.975)
        self.seed = self.P(0.50, 0.72)
        self.phases = self.build_phases()
        self.L = np.zeros((H, W), np.float32)          # Ätztiefe (0..1)
        self.scratch = np.zeros((H, W), np.float32)    # Nadelspur ohne Säure (dünn)
        self.fresh = []                                # frische Bisse für das Brodeln
        self.bubbles = []
        self.bake_ptr = 0
        self.events = sorted(s.notes, key=lambda n: n.start)
        self.ev_t = np.array([n.start for n in self.events])
        self.tone_t = np.array([t for (t, e) in s.tones])
        self.tone_e = [e for (t, e) in s.tones]
        self.blossom = None   # (center, t_last, count, phase)
        self.leaf_side = 1
        self.last_epiano = None
        self.prev_pen = None
        rng = np.random.default_rng(11)
        # Texturen
        tex = rng.random((H, W)).astype(np.float32)
        tex = cv2.GaussianBlur(tex, (0, 0), 0.8)
        brush = cv2.GaussianBlur(rng.random((H, 1)).astype(np.float32), (0, 0), 1.5)
        self.plate_tex = (0.80 + 0.28 * tex + 0.22 * (brush - 0.5))[..., None]
        ptex = cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 1.1)
        self.paper_tex = (0.94 + 0.09 * ptex)[..., None]
        ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
        self.diag = ((xs - self.px0) / self.pw * 0.7 + (ys - self.py0) / self.ph * 0.3)
        self.f_pencil = font('serif-italic', int(30 * H / 1080))
        self.f_pencil_small = font('serif-italic', int(24 * H / 1080))
        self.t_rinse = self.sec['Nachglühen'][0]
        self.t_print = self.sec['Letzte Blüten'][0]

    def post_params(self):
        return dict(glow=(0.8, 0.5), sigmas=(5, 30), vignette=0.38, grain=0.011, exposure=1.0)

    # ---------------------------------------------------------------- Koordinaten
    def P(self, u, v):
        return np.array([self.px0 + u * self.pw, self.py0 + v * self.ph])

    def build_phases(self):
        """[(t0, t1, Path, kind)] – die Nadel läuft in jeder Phase mit konstanter Geschwindigkeit."""
        s = self.score
        P = self.P
        S = self.seed
        bar = s.bar_s
        ph = []

        def add(b0, b1, pts, kind):
            ph.append((b0 * bar, b1 * bar, Path(pts), kind))

        # Erstes Licht: der Same – eine enge Spirale
        add(0, 8, spiral(S, 2, 15 * self.H / 1080, 2.6, phase=-math.pi / 2), 'seed')
        # Die Wurzeln: drei Wurzeln aus dem Samen
        roots = [[S, P(0.46, 0.80), P(0.40, 0.88), P(0.31, 0.97)],
                 [S, P(0.51, 0.82), P(0.50, 0.90), P(0.54, 0.99)],
                 [S, P(0.56, 0.79), P(0.63, 0.88), P(0.73, 0.95)]]
        wig = [0.6, -0.4, 0.8]
        for i, r in enumerate(roots):
            pts = bezier(r, 90)
            nrm = np.array([-(pts[-1] - pts[0])[1], (pts[-1] - pts[0])[0]]); nrm /= np.linalg.norm(nrm)
            u = np.linspace(0, 1, len(pts))[:, None]
            pts = pts + nrm * np.sin(u * TAU * 1.7 + i) * 9 * wig[i] * u
            add(8 + i * 16 / 3, 8 + (i + 1) * 16 / 3, pts, 'root')
        # Blüten aus Kupfer: Stängel A mit zwei Zweigen
        stemA = bezier([S, P(0.47, 0.58), P(0.50, 0.45), P(0.46, 0.30)], 80)
        add(24, 30, stemA, 'stem')
        a30 = stemA[-1]
        add(30, 32, bezier([a30, P(0.40, 0.33), P(0.33, 0.28)], 40), 'branch')
        stemA2 = bezier([a30, P(0.44, 0.25), P(0.46, 0.20), P(0.45, 0.15)], 50)
        add(32, 36, stemA2, 'stem')
        a36 = stemA2[-1]
        add(36, 38, bezier([a36, P(0.51, 0.19), P(0.56, 0.13)], 40), 'branch')
        add(38, 40, bezier([a36, P(0.44, 0.12), P(0.43, 0.09)], 30), 'stem')
        self.topA = P(0.43, 0.09)
        # Ein stiller Innenhof: der Kelch der ersten Blüte
        add(40, 48, spiral(self.topA, 8 * self.H / 1080, 3, 1.4, phase=math.pi / 2), 'calyx')
        # Der Garten antwortet: Stängel B
        S2 = P(0.56, 0.72)
        stemB = bezier([S2, P(0.62, 0.60), P(0.68, 0.48), P(0.65, 0.34)], 80)
        add(48, 56, stemB, 'stem')
        b56 = stemB[-1]
        add(56, 58, bezier([b56, P(0.72, 0.36), P(0.77, 0.30)], 40), 'branch')
        stemB2 = bezier([b56, P(0.63, 0.28), P(0.62, 0.22), P(0.60, 0.17)], 50)
        add(58, 61, stemB2, 'stem')
        b62 = stemB2[-1]
        self.topB = b62
        sprout = bezier([P(0.44, 0.72), P(0.37, 0.64), P(0.33, 0.58), P(0.34, 0.50)], 50)
        add(61, 64, sprout, 'stem')
        self.topC = sprout[-1]
        # Alles in Bewegung: Ranken
        def tendril(start, c, r0, turns, cw, phase):
            lead = bezier([start, (start + c) / 2 + np.array([0, -20 * self.H / 1080]), c + np.array([r0 * math.cos(phase), r0 * math.sin(phase)])], 30)
            sp = spiral(c, r0, 4 * self.H / 1080, turns, 110, phase=phase, cw=cw)
            u = np.linspace(0, 1, len(sp))[:, None]
            sp = sp + np.sin(u * TAU * 2.3) * 3 * self.H / 1080
            return np.vstack([lead, sp[1:]])
        add(64, 68, tendril(self.topA, P(0.51, 0.16), 40 * self.H / 1080, 1.7, 1, math.pi), 'tendril')
        add(68, 72, tendril(self.topB, P(0.69, 0.23), 36 * self.H / 1080, 1.6, -1, math.pi), 'tendril')
        vine = bezier([P(0.49, 0.42), P(0.55, 0.37), P(0.58, 0.47), P(0.64, 0.42)], 70)
        u = np.linspace(0, 1, len(vine))[:, None]
        vine = vine + np.array([0, 1.0]) * np.sin(u * TAU * 3) * 5 * self.H / 1080
        add(72, 76, vine, 'tendril')
        add(76, 80, tendril(self.topC, P(0.31, 0.42), 36 * self.H / 1080, 1.7, -1, math.pi / 2), 'tendril')
        # Nachglühen: die Nadel läuft die Plattenkante ab
        m = 7
        border = np.array([(self.px0 + m, self.py0 + m), (self.px1 - m, self.py0 + m), (self.px1 - m, self.py1 - m),
                           (self.px0 + m, self.py1 - m), (self.px0 + m, self.py0 + m)], np.float64)
        add(80, 88, border, 'border')
        # Letzte Blüten: eine Rosette über dem ersten Stängel
        add(88, 96, rose(self.topA, 30 * self.H / 1080, 5, 260, phase=-math.pi / 2), 'rose')
        return ph

    def phase_at(self, t):
        for (t0, t1, path, kind) in self.phases:
            if t0 <= t < t1:
                return t0, t1, path, kind
        return None

    def pen_at(self, t):
        ph = self.phase_at(t)
        if ph is None:
            return None, None, None
        t0, t1, path, kind = ph
        f = (t - t0) / (t1 - t0)
        return path.at(f), path.heading(f), kind

    def tone_at(self, t):
        k = int(np.searchsorted(self.tone_t, t, side='right')) - 1
        e = self.tone_e[max(0, k)]
        c = (e['cutoff'] - 110) / (1238 - 110)
        return min(max(c, 0.0), 1.0), e['resonance'], e['env'], e['decay']

    # ---------------------------------------------------------------- Ätzen (persistent)
    def _roi(self, pts, pad):
        p = np.asarray(pts, np.float64).reshape(-1, 2)
        x0 = max(int(math.floor(p[:, 0].min())) - pad, 0); y0 = max(int(math.floor(p[:, 1].min())) - pad, 0)
        x1 = min(int(math.ceil(p[:, 0].max())) + pad + 1, self.W); y1 = min(int(math.ceil(p[:, 1].max())) + pad + 1, self.H)
        if x1 <= x0 or y1 <= y0:
            return None
        return x0, y0, x1, y1

    def bite_line(self, pts, width, I, layer=None, closed=False):
        layer = self.L if layer is None else layer
        roi = self._roi(pts, int(width) + 3)
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        m = np.zeros((y1 - y0, x1 - x0), np.float32)
        ip = np.round((np.asarray(pts, np.float64) - [x0, y0]) * SUB).astype(np.int32).reshape(-1, 1, 2)
        cv2.polylines(m, [ip], closed, 1.0, max(1, int(round(width))), cv2.LINE_AA, shift=SHIFT)
        if width < 1.0:
            m *= width
        sub = layer[y0:y1, x0:x1]
        np.maximum(sub, m * I, out=sub)

    def bite_dot(self, c, r, I, layer=None):
        layer = self.L if layer is None else layer
        roi = self._roi([c], int(r) + 3)
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        m = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.circle(m, (int(round((c[0] - x0) * SUB)), int(round((c[1] - y0) * SUB))), int(round(r * SUB)), 1.0, -1, cv2.LINE_AA, shift=SHIFT)
        sub = layer[y0:y1, x0:x1]
        np.maximum(sub, m * I, out=sub)

    def petal(self, C, ang, length, width, I):
        d = np.array([math.cos(ang), math.sin(ang)])
        nrm = np.array([-d[1], d[0]])
        T = C + d * length
        left = bezier([C, C + d * length * 0.45 + nrm * width, T], 16)
        right = bezier([C, C + d * length * 0.45 - nrm * width, T], 16)
        self.bite_line(left, 1.3, I)
        self.bite_line(right, 1.3, I)
        self.bite_line(bezier([C, C + d * length * 0.5 + nrm * width * 0.15, C + d * length * 0.85], 10), 0.8, I * 0.6)

    def leaf(self, C, heading, side, length, I, thin=False):
        ang = heading + side * 0.95
        d = np.array([math.cos(ang), math.sin(ang)])
        nrm = np.array([-d[1], d[0]]) * side
        T = C + d * length
        w = length * (0.18 if thin else 0.32)
        self.bite_line(bezier([C, C + d * length * 0.4 + nrm * w, T], 14), 1.1, I)
        self.bite_line(bezier([C, C + d * length * 0.55 - nrm * w * 0.8, T], 14), 1.1, I)
        if not thin:
            self.bite_line(bezier([C, C + d * length * 0.5, C + d * length * 0.9], 8), 0.7, I * 0.55)

    def hatch(self, C, radius, n, I, rng, ang=math.pi / 4):
        d = np.array([math.cos(ang), math.sin(ang)])
        nrm = np.array([-d[1], d[0]])
        for _ in range(n):
            off = (rng.random() - 0.5) * 2 * radius
            along = (rng.random() - 0.5) * 2 * radius
            ln = radius * (0.3 + 0.5 * rng.random())
            c = C + nrm * off + d * along
            self.bite_line([c - d * ln, c + d * ln], 0.8, I)

    def bake_until(self, t):
        s = self.score
        H = self.H
        k = int(np.searchsorted(self.ev_t, t, side='right'))
        while self.bake_ptr < k:
            n = self.events[self.bake_ptr]
            self.bake_ptr += 1
            ph = self.phase_at(n.start)
            pen, head, kind = self.pen_at(n.start)
            rng = np.random.default_rng(2000 + (n.idx or 0))
            if n.machine == 'acid':
                if ph is None:
                    continue
                t0, t1, path, pk = ph
                f0 = (n.start - t0) / (t1 - t0)
                f1 = (min(n.end, t1) - t0) / (t1 - t0)
                c, res, envp, dec = self.tone_at(n.start)
                width = (1.0 + 2.2 * c + (0.8 if n.accent else 0.0)) * H / 1080
                if pk in ('tendril', 'calyx', 'rose'):
                    width *= 0.6
                I = 0.5 + 0.5 * c + (0.12 if n.accent else 0.0)
                pts = path.between(f0, f1)
                # Tonhöhe als feine Ornament-Verschiebung quer zur Nadel
                if pk not in ('border',) and len(pts) > 2:
                    hd = path.heading((f0 + f1) / 2)
                    nrm = np.array([-math.sin(hd), math.cos(hd)])
                    pts = pts + nrm * ((n.note - 41) * 0.22 * H / 1080)
                self.bite_line(pts, width, min(1.0, I))
                # Nadelspur zwischen den Bissen (ungeätzt, dünn)
                if self.prev_pen is not None and self.prev_pen[1] == pk and self.prev_pen[2] is ph[0]:
                    gap = path.between(self.prev_pen[0], f0)
                    if len(gap) > 1:
                        self.bite_line(gap, 0.8, 0.18, layer=self.scratch)
                self.prev_pen = (f1, pk, ph[0])
                self.fresh.append(dict(pts=pts, t=n.start, t_end=min(n.end, t1), c=c, res=res, env=envp,
                                       dec=dec / 1000 * 2.6, w=width, acc=n.accent))
                # Bläschen
                nb = 1 + int(c * 2 + (1 if n.accent else 0))
                for q in range(nb):
                    p0 = pts[int(rng.random() * (len(pts) - 1))]
                    self.bubbles.append(dict(p=p0.copy(), t=n.start + rng.random() * 0.2, vy=-(12 + 30 * rng.random()) * H / 1080,
                                             vx=(rng.random() - 0.5) * 8 * H / 1080, life=0.9 + 1.4 * rng.random(), r=(0.8 + 1.4 * rng.random()) * H / 1080))
                if len(self.fresh) > 400:
                    self.fresh = self.fresh[-400:]
                if len(self.bubbles) > 600:
                    self.bubbles = self.bubbles[-600:]
                continue
            if pen is None:
                pen, head, kind = self.topA, -math.pi / 2, 'rose'
            smp = n.sample
            if n.voice == 2 and smp in ('music-box', 'glass'):
                if kind == 'root':
                    # unter der Erde: Knollen
                    self.bite_dot(pen + np.array([(rng.random() - 0.5) * 16, (rng.random() - 0.5) * 10]) * H / 1080,
                                  (2.2 + 2.0 * rng.random()) * H / 1080, 0.55)
                    continue
                if kind == 'tendril' and smp == 'glass':
                    # Tautropfen an der Ranke
                    cpt = pen + np.array([(rng.random() - 0.5) * 6, (rng.random() - 0.5) * 6]) * H / 1080
                    r = (2.5 + 1.5 * rng.random()) * H / 1080
                    self.bite_line(spiral(cpt, r, r, 1.0, 20), 0.9, 0.7, closed=True)
                    self.bite_dot(cpt + np.array([-r * 0.35, -r * 0.35]), r * 0.3, 0.9)
                    continue
                # Blüte: Mittelpunkt bei der ersten Note einer Phrase, jede Note ein Blatt
                if self.blossom is None or n.start - self.blossom['t'] > 2.2 * s.bar_s or np.linalg.norm(pen - self.blossom['c']) > 70 * H / 1080 and self.blossom['n'] >= 5:
                    base = pen if kind not in ('border', 'calyx', 'rose') else (self.topA if kind != 'border' else self.topB)
                    self.blossom = dict(c=base.copy(), t=n.start, n=0)
                b = self.blossom
                ang = -math.pi / 2 + (n.note - 68) * (math.pi / 13.0) + (rng.random() - 0.5) * 0.12
                ln = (22 + 7.0 * min(n.gate or 2, 6)) * H / 1080
                wd = ln * (0.2 if smp == 'glass' else 0.3)
                self.petal(b['c'], ang, ln, wd, 0.75 + 0.2 * n.vel)
                b['t'] = n.start; b['n'] += 1
                if b['n'] == 1:
                    self.bite_dot(b['c'], 2.0 * H / 1080, 0.8)
            elif n.voice == 3 and smp == 'epiano':
                if self.last_epiano is not None and n.start - self.last_epiano < 1.5 * s.step_s:
                    self.last_epiano = n.start
                    continue  # nur die erste Note eines Akkords trägt ein Blatt
                self.last_epiano = n.start
                self.leaf_side *= -1
                ln = (20 + 26 * (n.note - 57) / 22) * H / 1080
                if kind == 'root':
                    self.leaf(pen, head, self.leaf_side, ln * 0.45, 0.5, thin=True)
                elif kind in ('border',):
                    continue
                elif kind == 'rose':
                    self.leaf(self.topA + np.array([0, 40 * H / 1080]), -math.pi / 2, self.leaf_side, ln * 0.8, 0.7)
                else:
                    self.leaf(pen, head, self.leaf_side, ln, 0.7)
            elif n.voice == 3 and smp == 'pluck':
                # Dornen an der Ranke
                d = np.array([math.cos(head + math.pi / 2 * self.leaf_side), math.sin(head + math.pi / 2 * self.leaf_side)])
                self.leaf_side *= -1
                self.bite_line([pen, pen + d * (7 + 6 * rng.random()) * H / 1080], 1.0, 0.75)
            elif n.voice == 3 and smp == 'warm-pad':
                # Aquatinta: feine Punktwolke als Ton hinter der Pflanze
                c = pen if kind not in ('border', 'calyx', 'rose') else self.P(0.28 + 0.44 * rng.random(), 0.15 + 0.6 * rng.random())
                c = c + np.array([(rng.random() - 0.5) * 140, (rng.random() - 0.5) * 100]) * H / 1080
                rad = (28 + 26 * rng.random()) * H / 1080
                for _ in range(40):
                    a = rng.random() * TAU; rr = rad * math.sqrt(rng.random())
                    self.bite_dot(c + np.array([math.cos(a) * rr, math.sin(a) * rr]), 0.6 * H / 1080, 0.14)
            elif smp in ('hat', 'open-hat'):
                m = 3 if smp == 'hat' else 7
                for _ in range(m):
                    c = pen + np.array([(rng.random() - 0.5) * 24, (rng.random() - 0.5) * 24]) * H / 1080
                    self.bite_dot(c, 0.9 * H / 1080, 0.5)
            elif smp == 'snare':
                a = head + math.pi / 4
                d = np.array([math.cos(a), math.sin(a)])
                for q in range(3):
                    c = pen + np.array([(rng.random() - 0.5) * 20, (rng.random() - 0.5) * 20]) * H / 1080
                    self.bite_line([c - d * 4 * H / 1080, c + d * 4 * H / 1080], 0.9, 0.5)
            elif smp == 'clap':
                a = head - math.pi / 3
                d = np.array([math.cos(a), math.sin(a)])
                c = pen + np.array([(rng.random() - 0.5) * 30, (rng.random() - 0.5) * 30]) * H / 1080
                self.bite_line([c - d * 16 * H / 1080, c + d * 16 * H / 1080], 1.0, 0.55)
            elif smp == 'shaker':
                for _ in range(8):
                    c = pen + np.array([(rng.random() - 0.5) * 50, (rng.random() - 0.5) * 50]) * H / 1080
                    self.bite_dot(c, 0.7 * H / 1080, 0.35)
            # deep-kick: nur Pulse im Bild, nichts Bleibendes

    def warmup(self, t, fps):
        self.bake_until(t)

    # ---------------------------------------------------------------- Bild
    def frame(self, t, i):
        s, cv = self.score, self.canvas
        W, H = self.W, self.H
        self.bake_until(t)
        a_r, b_r = self.sec['Nachglühen']
        rinse = smooth(min(max((t - a_r) / (b_r - a_r) * 1.4, 0.0), 1.0)) if t >= a_r else 0.0
        inked = smooth(min(max((t - a_r - 4.0) / 8.0, 0.0), 1.0)) if t >= a_r else 0.0
        prt = min(max((t - self.t_print) / (3 * s.bar_s), 0.0), 1.0) if t >= self.t_print else 0.0
        wipe_y = self.qy0 + (self.qy1 - self.qy0 + 40) * ease_in_out(prt)
        # Erstes Licht: die Platte taucht aus dem Dunkel auf
        reveal = smooth(min(t / (8 * s.bar_s), 1.0))
        kick = 0.0
        j = int(np.searchsorted(self.ev_t, t, side='right'))
        for n in self.events[max(0, j - 40):j]:
            if n.sample == 'deep-kick' and t - n.start < 0.4:
                kick += env(t, n.start, 0.01, 0.12) * n.vel
        # --- Platte (nur im Plattenrechteck gerechnet)
        y0, y1, x0, x1 = self.py0, self.py1, self.px0, self.px1
        dg = self.diag[y0:y1, x0:x1]
        hl = np.exp(-((dg - (0.1 + 0.9 * ((t * 0.02 + 0.3) % 1.0))) ** 2) / 0.05)
        if reveal < 1.0:
            hl2 = np.exp(-((dg - (reveal * 1.3 - 0.15)) ** 2) / 0.03) * (1 - reveal)
            gloss = (1.0 + 0.9 * hl + 3.0 * hl2)[..., None]
        else:
            gloss = (1.0 + 0.9 * hl)[..., None]
        Lc = np.clip(self.L[y0:y1, x0:x1], 0, 1)[..., None]
        Sc = np.clip(self.scratch[y0:y1, x0:x1], 0, 1)[..., None]
        plate_base = mix(GROUND, COPPER, 0.25 + 0.75 * reveal) * (0.3 + 0.7 * reveal) * 0.9
        plate = plate_base * self.plate_tex[y0:y1, x0:x1] * gloss * ((1.0 + 0.05 * kick) * (1 - 0.35 * inked))
        line_col = mix(mix(BITE, BITE_DEEP, Lc ** 2.5), INK_BLACK, inked) * (0.6 + 0.4 * np.clip(gloss, 0, 1.6))
        a92 = Lc * 0.92
        img_plate = plate * (1 - a92) + line_col * a92
        img_plate = img_plate * (1 - Sc * 0.5) + mix(COPPER_HI, INK_BLACK, inked) * (Sc * 0.5)
        cv.base[:] = TABLE
        if prt <= 0:
            cv.base[y0:y1, x0:x1] = img_plate
            cv.stroke([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], COPPER_HI, 1.0, 0.35 * reveal, closed=True)
        else:
            # --- Blatt (Abzug), nur im Blattrechteck gerechnet
            qy0, qy1, qx0, qx1 = self.qy0, self.qy1, self.qx0, self.qx1
            if not hasattr(self, '_print_static'):
                inside = np.zeros((qy1 - qy0, qx1 - qx0, 1), np.float32)
                inside[y0 - qy0:y1 - qy0, x0 - qx0:x1 - qx0] = 1.0
                e = np.zeros((qy1 - qy0, qx1 - qx0), np.float32)
                cv2.rectangle(e, (x0 - qx0, y0 - qy0), (x1 - qx0, y1 - qy0), 1.0, 2)
                e = cv2.GaussianBlur(e, (0, 0), 1.0)[..., None]
                paper = PAPER * self.paper_tex[qy0:qy1, qx0:qx1] * (1 - 0.06 * inside) * (1 - e * 0.35)
                self._print_static = (inside, paper)
            inside, paper = self._print_static
            Lq = np.clip(self.L[qy0:qy1, qx0:qx1], 0, 1)[..., None]
            Sq = np.clip(self.scratch[qy0:qy1, qx0:qx1], 0, 1)[..., None]
            ink_a = (np.clip(Lq * 1.7, 0, 1) ** 0.8) * (0.96 * inside)
            print_img = paper * (1 - ink_a) + INK_BLACK * ink_a
            sq = Sq * (0.25 * inside)
            print_img = print_img * (1 - sq) + PAPER_SHADE * sq
            # Platte unter dem Blatt
            cv.base[y0:y1, x0:x1] = img_plate
            ys = np.arange(qy0, qy1, dtype=np.float32)[:, None, None]
            cover = np.clip((wipe_y - ys) / 26.0, 0, 1)
            sub = cv.base[qy0:qy1, qx0:qx1]
            sub *= (1 - cover)
            sub += print_img * cover
            if prt < 1.0:
                shadow = np.exp(-np.clip(ys - wipe_y, 0, None) / 30.0) * (ys > wipe_y)
                sub *= (1 - 0.45 * shadow)

        # --- Brodeln der Säure (frische Bisse), bis zum Abspülen
        if rinse < 1.0:
            for d in self.fresh[-120:]:
                age = t - d['t']
                if age < 0:
                    continue
                dur = max(d['t_end'] - d['t'], 0.05)
                a = env(t, d['t'], 0.02, d['dec'] * (1.0 + 0.6 * (d['env'] - 36) / 34))
                if age > dur + d['dec'] * 3:
                    continue
                a *= (1 - rinse)
                if a < 0.01:
                    continue
                ww = d['w']
                resw = 1.0 + (d['res'] - 43) / 33 * 1.6
                cv.glow_line(d['pts'], FIZZ * (0.9 * a * (0.5 + 0.7 * d['c'])), width=max(1.5, ww * 1.6 * resw))
                cv.glow_line(d['pts'], FIZZ_CORE * (0.7 * a * (0.4 + 0.8 * d['c']) * (1.4 if d['acc'] else 1.0)), width=max(1.0, ww * 0.6))
            for b in self.bubbles[-200:]:
                age = t - b['t']
                if age < 0 or age > b['life']:
                    continue
                u = age / b['life']
                p = (b['p'][0] + b['vx'] * age, b['p'][1] + b['vy'] * age * (1 - 0.3 * u))
                if not (self.px0 + 2 < p[0] < self.px1 - 2 and self.py0 + 2 < p[1] < self.py1 - 2):
                    continue
                cv.glow_point(p, FIZZ_CORE * (0.9 * (1 - u) ** 1.5 * (1 - rinse)), size=b['r'])
        # --- Nadel (das Jetzt): ein kleiner heller Punkt
        pen, head, kind = self.pen_at(t)
        if pen is not None and prt < 1.0:
            cv.glow_point(pen, (FIZZ_CORE if rinse < 1 else INK) * (0.9 * (1 - 0.6 * inked)), size=2.2 * H / 1080)

        # --- Schrift
        self.cap.title(cv, 'SMALL MACHINES  ·  ACID/16 × PAULA/68', 'Säureblumen',
                       f'{s.bpm} BPM  ·  d-Moll  ·  eine Radierung', t, INK, dur=8.0, y_rel=0.16)
        for jx, (name, a, b, _, _) in enumerate(s.sections):
            if jx == 0:
                continue
            self.cap.section(cv, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][jx], name, t - a, INK if prt < 0.5 else PENCIL)
        # Bleistift unter dem Abzug
        if prt >= 1.0:
            a = fade_window(t - (self.t_print + 3 * s.bar_s + 1.0), 2.0, 60.0, 0.1)
            if a > 0:
                y = self.py1 + 34 * H / 1080
                cv.text('ACID/16 × PAULA/68', (self.px0 + 4, y), self.f_pencil_small, PENCIL, alpha=0.85 * a, anchor='ls')
                cv.text('Säureblumen', (W / 2, y), self.f_pencil, PENCIL, alpha=0.9 * a, anchor='ms')
                cv.text('Small Machines, 2026', (self.px1 - 4, y), self.f_pencil_small, PENCIL, alpha=0.85 * a, anchor='rs')
        return self.master_fade(t) if t < 2.0 else 1.0 if t < s.duration - 1.5 else max(0.0, (s.duration - t) / 1.5)
