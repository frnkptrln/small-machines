"""
DREI STIMMEN IM NEON — SID/65 solo, 118 BPM, a-Moll, 64 Takte.

Drei Neonröhren an einer nassen Straße. Jede Röhre ist eine Stimme des SID,
und jede Röhre ist zur Wellenform ihrer Stimme gebogen: Puls, Sägezahn, Rauschen/Dreieck.
Mit jeder Note bekommt die Röhre die Form der neuen Tonhöhe (mehr Zyklen = höherer Ton),
zündet mit kurzem Flackern und leuchtet so hell, wie die Hüllkurve des Chips es vorschreibt.
Unten spiegelt der Regen die drei Stimmen.
"""
import math
import numpy as np
import cv2
from engine import Film, hexc, mix, smooth, ease_out, fade_window

TAU = 2 * math.pi
INK = hexc('#d9c9a8')

# SID-Hüllkurven (Sekunden) – Näherung an die Chiptabellen
ATTACK = [0.002, 0.008, 0.016, 0.024, 0.038, 0.056, 0.068, 0.08, 0.1, 0.25, 0.5, 0.8, 1, 3, 5, 8]
DECAY = [0.006, 0.024, 0.048, 0.072, 0.114, 0.168, 0.204, 0.24, 0.3, 0.75, 1.5, 2.4, 3, 9, 15, 24]

VOICE_COL = {
    0: (hexc('#ffb347'), hexc('#fff1d6')),   # Melodie: Bernstein-Neon
    1: (hexc('#ff3e2e'), hexc('#ffd2c8')),   # Bass: rotes Neon
    2: (hexc('#8fd0ff'), hexc('#eaf6ff')),   # Schlagwerk: Argon-Blau
}


def midi_hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def sid_env(t, n, vdef, t_cut=None):
    """Hüllkurvenpegel 0..1 zur Zeit t für Note n (Start n.start, Gate bis n.end)."""
    a = ATTACK[vdef['attack']]
    d = DECAY[vdef['decay']]
    s = vdef['sustain'] / 15
    r = DECAY[vdef['release']]
    dt = t - n.start
    if dt < 0:
        return 0.0
    gate_end = n.end

    def level_during(x):
        if x < a:
            return x / a if a > 0 else 1.0
        x -= a
        if x < d:
            return 1 - (1 - s) * (x / d) if d > 0 else s
        return s

    if t < gate_end:
        return level_during(dt)
    lvl = level_during(gate_end - n.start)
    x = t - gate_end
    if r <= 0:
        return 0.0
    return max(0.0, lvl * (1 - x / r)) if x < r else 0.0


class Neon(Film):
    BG = '#050508'

    def __init__(self, score, W, H, fps):
        super().__init__(score, W, H, fps)
        s = self.score
        self.sec = {name: (a, b) for (name, a, b, _, _) in s.sections}
        self.x0, self.x1 = W * 0.16, W * 0.84
        self.ground = H * 0.775
        self.ys = {0: H * 0.285, 1: H * 0.495, 2: H * 0.665}
        self.amp = {0: H * 0.065, 1: H * 0.085, 2: H * 0.05}
        self.notes_v = {v: [n for n in s.notes if n.voice == v] for v in range(3)}
        self.starts_v = {v: np.array([n.start for n in self.notes_v[v]]) for v in range(3)}
        # Regen
        rng = np.random.default_rng(31)
        self.rain = np.stack([rng.random(160), rng.random(160), 0.6 + 0.8 * rng.random(160), rng.random(160)], axis=1)
        # Spiegelungs-Abbildung
        gy = int(self.ground)
        hh = H - gy
        ys, xs = np.mgrid[0:hh, 0:W].astype(np.float32)
        self.map_y = (gy - 1 - ys * 2.6).astype(np.float32)  # gestaucht: das ganze Schild passt in den Boden
        self.map_x_base = xs
        self.refl_fall = (np.clip(1 - ys / hh, 0, 1) ** 1.3 * 0.55)[..., None].astype(np.float32)
        self.gy = gy
        self.hh = hh
        self.rows = ys

    def post_params(self):
        return dict(glow=(1.1, 0.7), sigmas=(5, 34), vignette=0.5, grain=0.013, exposure=1.0)

    # ---------------------------------------------------------------- Projektion der Schildfläche
    def project(self, pts):
        """leichte Perspektive: das Schild weicht nach rechts zurück"""
        p = np.asarray(pts, np.float64).copy()
        u = (p[:, 0] - self.x0) / (self.x1 - self.x0)
        sc = 1 - 0.22 * u
        p[:, 1] = self.ground - (self.ground - p[:, 1]) * sc
        p[:, 0] = self.x0 + (p[:, 0] - self.x0) * (1 - 0.10 * u)
        return p

    # ---------------------------------------------------------------- Röhrenformen
    def shape_points(self, n, v, t):
        """Punkte der Röhre (unprojiziert) für Note n der Stimme v zur Zeit t."""
        xs0, xs1 = self.x0, self.x1
        width = xs1 - xs0
        yc = self.ys[v]
        A = self.amp[v]
        wave = n.wave
        hz = midi_hz(n.note)
        sweep = n.sweep if hasattr(n, 'sweep') else None
        if v == 2 and n.note <= 65 and wave == 'triangle':
            # Bassdrum: Dreieck, das in 21 ms nach unten gleitet
            dt = max(0.0, t - n.start)
            f0, f1 = hz, midi_hz(29)
            hz = f1 + (f0 - f1) * math.exp(-dt / 0.021)
        if wave == 'noise':
            k = 64
            rng = np.random.default_rng((n.idx or 0) * 7919 + int(t * 60))
            xs = np.linspace(xs0, xs1, k)
            ys = yc + (rng.random(k) - 0.5) * 2 * A * (0.9 if n.note > 80 else 1.3)
            return np.stack([xs, ys], axis=1)
        base = {0: 95.0, 1: 27.0, 2: 55.0}[v]
        cycles = min(16.0, max(1.5, hz / base))
        if wave == 'pulse':
            pw = (n.pw if hasattr(n, 'pw') else 24) / 100
            pts = []
            per = width / cycles
            x = xs0
            hi, lo = yc - A, yc + A
            pts.append((x, lo))
            while x < xs1 - 1e-6:
                x2 = min(x + per * pw, xs1)
                pts += [(x, hi), (x2, hi)]
                x3 = min(x + per, xs1)
                pts += [(x2, lo), (x3, lo)]
                x = x3
            return np.array(pts)
        if wave == 'saw':
            pts = []
            per = width / cycles
            x = xs0
            while x < xs1 - 1e-6:
                x2 = min(x + per, xs1)
                pts += [(x, yc + A), (x2, yc - A)]
                x = x2
            return np.array(pts)
        # Dreieck
        k = int(cycles * 2) + 1
        xs = np.linspace(xs0, xs1, k + 1)
        ys = np.array([yc + (A if i % 2 == 0 else -A) for i in range(k + 1)])
        return np.stack([xs, ys], axis=1)

    def voice_state(self, v, t):
        """aktuelle und vorige Note der Stimme mit Hüllkurvenpegeln"""
        notes, starts = self.notes_v[v], self.starts_v[v]
        k = int(np.searchsorted(starts, t, side='right'))
        out = []
        vdef0 = self.score.voices_def[v]
        for n in notes[max(0, k - 3):k]:
            vdef = n.patch if getattr(n, 'patch', None) else vdef0
            lvl = sid_env(t, n, vdef)
            if lvl > 0.003 or (t - n.start) < 0.05:
                out.append((n, lvl))
        return out

    # ---------------------------------------------------------------- Bild
    def frame(self, t, i):
        s, cv = self.score, self.canvas
        W, H = self.W, self.H
        tm = min(t, s.music_s)

        def sec_w(name, ramp=3.0):
            a, b = self.sec[name]
            if t < a - ramp or t > b + ramp:
                return 0.0
            return smooth((t - (a - ramp)) / ramp) * smooth(((b + ramp) - t) / ramp) if (t < a or t > b) else 1.0
        w_leer = sec_w('Leere Straße')
        w_on = sec_w('Einschalten', 0.5)
        dim = 1 - 0.35 * w_leer

        # Wand / Schildkasten: kaum sichtbare Fläche
        box = self.project([(self.x0 - 40, self.ys[0] - 120), (self.x1 + 40, self.ys[0] - 120),
                            (self.x1 + 40, self.ys[2] + 90), (self.x0 - 40, self.ys[2] + 90)])
        cv.fill_poly(box, hexc('#0b0b12'), 0.9)
        cv.stroke(box, INK, 1.0, 0.07, closed=True)

        total_light = 0.0
        shake = 0.0
        # Kicks lassen das Schild minimal zittern
        for n, lvl in self.voice_state(2, t):
            if n.wave == 'triangle' and n.note <= 65:
                shake += 2.5 * lvl
        for v in range(3):
            col, core = VOICE_COL[v]
            states = self.voice_state(v, t)
            # letzte Note bestimmt die aktuelle (unbeleuchtete) Röhrenform
            notes, starts = self.notes_v[v], self.starts_v[v]
            k = int(np.searchsorted(starts, t, side='right'))
            if k > 0:
                cur = notes[k - 1]
                pts = self.shape_points(cur, v, t)
                pp = self.project(pts)
                pp[:, 1] += shake * math.sin(t * 90 + v)
                cv.stroke(pp, hexc('#2a2a36'), 2.5 * H / 1080, 0.55)  # dunkles Glas
            for n, lvl in states:
                pts = self.shape_points(n, v, t)
                pp = self.project(pts)
                pp[:, 1] += shake * math.sin(t * 90 + v)
                # Zündflackern in den ersten 140 ms
                dt = t - n.start
                fl = 1.0
                if dt < 0.14:
                    h = (int((n.idx or 0) * 131 + dt * 240) * 2654435761) & 0xffff
                    fl = 0.25 + 0.75 * ((h / 65535.0) > 0.35)
                b = (lvl ** 0.7) * fl * dim * n.vel
                if b <= 0.002:
                    continue
                total_light += b
                cv.glow_line(pp, col * (1.3 * b), width=3.2 * H / 1080)
                cv.glow_line(pp, core * (0.9 * b), width=1.3 * H / 1080)
                cv.stroke(pp, mix(core, col, 0.4), 1.4 * H / 1080, 0.85 * min(1, b * 2))
            # Elektrodenkappen
            for xe in (self.x0, self.x1):
                pe = self.project([(xe, self.ys[v])])[0]
                cv.circle(pe, 4 * H / 1080, hexc('#141420'), 1.0)
                cv.circle(pe, 4 * H / 1080, INK, 0.25, width=1)

        # Boden: nasse Straße mit Spiegelung der Röhren
        self.reflection(t, w_leer)
        # Horizontlinie / Bordstein
        cv.stroke([(0, self.ground), (W, self.ground)], INK, 1.0, 0.08)
        # Regen
        self.rain_layer(t, 0.35 + 0.9 * w_leer, min(1.0, 0.25 + total_light * 0.35))

        # Schrift
        self.cap.title(cv, 'SMALL MACHINES  ·  SID/65', 'Drei Stimmen im Neon',
                       f'{s.bpm} BPM  ·  {s.key}  ·  drei Synthesestimmen', t, INK, dur=8.0, y_rel=0.825)
        for j, (name, a, b, _, _) in enumerate(s.sections):
            if j == 0:
                continue
            self.cap.section(cv, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][j], name, t - a, INK)
        if t > s.music_s + 1.6:
            self.cap.credits(cv, [('Drei Stimmen im Neon', 'title'),
                                  ('Small Machines', 'name'),
                                  ('SID/65', 'small'),
                                  ('Allein und zusammen  ·  Berlin, Oktober 2026', 'small')], t - (s.music_s + 1.6), INK, dur=s.tail - 2.0)
        return self.master_fade(t) if t < 1.5 else 1.0 if t < s.duration - 1.5 else max(0.0, (s.duration - t) / 1.5)

    def reflection(self, t, wet):
        E = self.canvas.emit
        src = E[:self.gy]
        # Welligkeit
        ripple = (np.sin(self.rows * 0.21 + t * 2.1) * (2.5 + 4 * wet) + np.sin(self.rows * 0.047 - t * 0.9) * 3.0).astype(np.float32)
        map_x = self.map_x_base + ripple
        refl = cv2.remap(E, map_x, self.map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        refl = cv2.GaussianBlur(refl, (0, 0), 2.5 + 3 * wet)
        E[self.gy:] += refl * self.refl_fall * (0.8 + 0.5 * wet)
        # Straße: leichte Aufhellung nahe am Horizont
        self.canvas.base[self.gy:] += (self.refl_fall * 0.012)

    def rain_layer(self, t, intensity, light):
        if intensity <= 0:
            return
        W, H = self.W, self.H
        n = int(len(self.rain) * min(1.0, intensity))
        col = hexc('#cfd8e6') * (0.055 * light)
        for j in range(n):
            x0, y0, spd, ph = self.rain[j]
            y = ((y0 + t * spd * 0.9 + ph) % 1.2) - 0.1
            x = (x0 + t * 0.012 * spd) % 1.0
            px, py = x * W, y * H
            ln = (16 + 22 * spd) * H / 1080
            self.canvas.glow_line([(px, py), (px - ln * 0.08, py + ln)], col, width=1.0)
