"""
FENSTERLICHT AUF MAGNETBAND — SID/65 + PAULA/68, 92 BPM, d-Moll, 64 Takte.

Ein Tonband läuft von rechts nach links durch das Bild, zwischen zwei Spulen.
Am Aufnahmekopf schreibt PAULA ihre Samples als Magnetisierungsspuren auf das Band:
Bassdrum = breiter Balken, Tasten = kurze Striche in Tonhöhe, Glas = helle Striche,
Shaker = Staub, Snare = Kratzer. Das Geschriebene wandert mit dem Band nach links – die
jüngste Vergangenheit bleibt sichtbar, dann läuft sie aus dem Bild.
Der SID ist das Fensterlicht: lange Dreiecksstimmen sind breite Lichtbahnen, die von
oben auf das Band fallen; die Pulsmelodie ein schmaler Lichtstreifen, der mit der
Tonhöhe wandert; der Bass ein warmes Bodenlicht. Im Licht schwebt Staub.
„Band läuft aus": das Ende des Bandes passiert den Kopf, die Spule dreht leer.
"""
import math
import numpy as np
import cv2
from engine import Film, hexc, mix, smooth, ease_out, ease_in_out, env
from film_neon import sid_env

TAU = 2 * math.pi
INK = hexc('#d9c9a8')
TAPE = hexc('#231810')
TAPE_EDGE = hexc('#5a4330')
LEADER = hexc('#d8d2c4')
WINDOW = hexc('#ffd79a')
WINDOW2 = hexc('#ffe9c4')
FLOOR = hexc('#7a4a22')
KICK = hexc('#ff9a4a')
KEY = hexc('#f0d9a0')
GLASS = hexc('#bfe6ff')
SNARE = hexc('#fff0dc')
DUST = hexc('#ffe9c0')


class Magnetband(Film):
    BG = '#05050a'

    def __init__(self, score, W, H, fps):
        super().__init__(score, W, H, fps)
        s = self.score
        self.sec = {name: (a, b) for (name, a, b, _, _) in s.sections}
        self.v = W / 6.5                 # Bandgeschwindigkeit px/s
        self.x_head = W * 0.62
        self.y0, self.y1 = H * 0.46, H * 0.66
        self.paula = [n for n in s.notes if n.machine == 'paula']
        self.paula_t = np.array([n.start for n in self.paula])
        self.sid = {v: [n for n in s.notes if n.machine == 'sid' and n.voice == v] for v in range(3)}
        rng = np.random.default_rng(5)
        # Oxidtextur des Bandes (kachelbar)
        th = int(self.y1 - self.y0)
        tex = rng.random((th, W)).astype(np.float32)
        tex = cv2.GaussianBlur(tex, (0, 0), 1.2)
        tex = (tex - tex.min()) / (tex.max() - tex.min() + 1e-6)
        self.tex = tex
        # Staub im Licht
        self.motes = np.stack([rng.random(140), rng.random(140), 0.3 + rng.random(140), rng.random(140) * TAU], axis=1)
        self.marks = []
        for n in self.paula:
            r = np.random.default_rng(700 + n.idx)
            self.marks.append(dict(n=n, j=r.random(), k=r.random()))
        self.t_end = s.music_s  # Bandende passiert den Kopf
        ys = np.linspace(0, 1, H // 4, dtype=np.float32)[:, None]
        self.shaft_vgrad = (1.0 - 0.55 * ys ** 1.2)
        self.leader_len = self.v * 2.2

    def post_params(self):
        return dict(glow=(0.9, 0.7), sigmas=(6, 40), vignette=0.48, grain=0.014, exposure=1.0)

    def frame(self, t, i):
        s, cv = self.score, self.canvas
        W, H = self.W, self.H
        y0, y1 = self.y0, self.y1
        th = y1 - y0
        vdef = s.voices_def

        # ---------- Bodenlicht (SID-Bass)
        floor = 0.0
        for n in self.sid[1]:
            if n.start - 0.05 <= t < n.end + 1.5:
                floor = max(floor, sid_env(t, n, vdef[1]) * (0.6 + 0.4 * (n.note - 34) / 19))
        if floor > 0.003:
            self.vgrad(H * 0.78, H, FLOOR * (0.10 * floor ** 0.8))

        # ---------- Fensterlicht: breite Bahnen (Stimme 3) und schmaler Streifen (Stimme 1)
        shafts = []  # (x_top, width, intensity)
        for n in self.sid[2]:
            if n.start - 0.1 <= t < n.end + 3.0:
                lv = sid_env(t, n, vdef[2])
                if lv > 0.003:
                    k = (n.idx % 5)
                    xt = W * (0.22 + 0.13 * k) + math.sin(t * 0.07 + k) * W * 0.02
                    shafts.append((xt, W * 0.11, lv ** 0.8 * 0.9))
        a_on, b_on = self.sec['Fenster auf']
        opening = smooth(min(max((t - a_on) / (b_on - a_on), 0.0), 1.0))
        for n in self.sid[0]:
            if n.start - 0.05 <= t < n.end + 1.5:
                lv = sid_env(t, n, vdef[0])
                if lv > 0.003:
                    u = (n.note - 57) / 24.0
                    xt = W * (0.18 + 0.60 * u)
                    shafts.append((xt, W * 0.022, lv ** 0.7 * 1.3))
        shear = -W * 0.10  # Licht kommt von links oben
        if shafts:
            sh = np.zeros((H // 4, W // 4), np.float32)
            for (xt, wdt, it) in shafts:
                wdt *= (0.25 + 0.75 * opening)
                poly = np.array([(xt, 0), (xt + wdt, 0), (xt + wdt + shear, H), (xt + shear, H)]) / 4.0
                m = np.zeros_like(sh)
                cv2.fillPoly(m, [np.round(poly * 256).astype(np.int32).reshape(-1, 1, 2)], 1.0, cv2.LINE_AA, shift=8)
                sh += m * it
            sh = cv2.GaussianBlur(sh, (0, 0), 2.5)
            sh *= self.shaft_vgrad
            up = cv2.resize(sh, (W, H), interpolation=cv2.INTER_CUBIC)
            cv.emit += up[..., None] * (hexc('#ffd08a') * 0.05)
            self._shaft_up = up
        else:
            self._shaft_up = None
        # Staub in den Lichtbahnen
        for (mx, my, sp, ph) in self.motes:
            x = ((mx + 0.012 * t * sp + 0.004 * math.sin(t * 0.5 + ph)) % 1.0) * W
            y = ((my + 0.006 * t * sp) % 1.0) * H
            lit = 0.0
            for (xt, wdt, it) in shafts:
                xs = xt + shear * (y / H)
                if xs - 8 <= x <= xs + wdt + 8:
                    lit += it
            if lit > 0.01:
                cv.glow_point((x, y), DUST * (0.45 * min(1.0, lit)), size=1.3 * H / 1080)

        # ---------- Spulen (nur Ränder sichtbar)
        ang = (self.v * t) / (H * 0.36)
        for (cx, cy, r, sgn) in ((-W * 0.06, H * 0.56, H * 0.33, 1), (W * 1.06, H * 0.56, H * 0.33, 1)):
            cv.circle((cx, cy), r, hexc('#0c0b11'), 1.0)
            cv.circle((cx, cy), r, INK, 0.12, width=1)
            for k in range(3):
                a = ang * sgn + k * TAU / 3
                p0 = (cx + math.cos(a) * r * 0.2, cy + math.sin(a) * r * 0.2)
                p1 = (cx + math.cos(a) * r * 0.95, cy + math.sin(a) * r * 0.95)
                cv.stroke([p0, p1], INK, 1.5, 0.07)

        # ---------- Das Band
        off = int((self.v * t) % W)
        tex = np.roll(self.tex, off, axis=1)
        band = cv.base[int(y0):int(y0) + tex.shape[0], :, :]
        # Bandende: ab t_end wandert ein helles Vorspannband und dann Leere von rechts herein
        x_end = self.x_head + self.v * (self.t_end - t)  # Position des Bandendes
        col = TAPE[None, None, :] * (0.55 + 0.45 * tex[..., None])
        band[:] = col
        if self._shaft_up is not None:
            lit = self._shaft_up[int(y0):int(y0) + tex.shape[0], :, None]
            band += lit * (WINDOW * 0.09) * (0.6 + 0.4 * tex[..., None])
        # Ränder
        cv.stroke([(0, y0), (W, y0)], TAPE_EDGE, 1.0, 0.7)
        cv.stroke([(0, y1), (W, y1)], TAPE_EDGE, 1.0, 0.7)
        # Spuren
        k = int(np.searchsorted(self.paula_t, t, side='right'))
        for m in self.marks[max(0, k - 140):k]:
            n = m['n']
            x = self.x_head - self.v * (t - n.start)
            if x < -60:
                continue
            age = t - n.start
            fresh = env(t, n.start, 0.01, 0.35)
            smp = n.sample
            if smp == 'deep-kick':
                w = 10 * W / 1920
                poly = [(x - w, y0), (x + w, y0), (x + w, y1), (x - w, y1)]
                cv.fill_poly(poly, hexc('#4a2d18'), 0.9 * n.vel)
                cv.glow_poly(poly, KICK * (0.7 * fresh * n.vel))
            elif smp in ('epiano', 'glass'):
                u = (n.note - 60) / 21.0
                yy = y1 - th * (0.12 + 0.76 * u)
                ln = th * (0.09 if smp == 'epiano' else 0.16)
                colr = KEY if smp == 'epiano' else GLASS
                cv.stroke([(x, yy - ln), (x, yy + ln)], colr, 2.0, 0.75 * n.vel)
                cv.glow_line([(x, yy - ln), (x, yy + ln)], colr * ((1.6 if smp == 'glass' else 1.0) * fresh * n.vel), width=2.0)
            elif smp == 'shaker':
                for q in range(4):
                    yy = y0 + th * ((m['j'] * 7 + q * 0.23) % 1.0)
                    cv.circle((x + (q - 1.5) * 3, yy), 1.0, KEY, 0.5 * n.vel)
                if fresh > 0.05:
                    cv.glow_point((x, y0 + th * m['j']), DUST * (0.8 * fresh), size=2.0)
            elif smp == 'snare':
                cv.stroke([(x - 6, y1 - th * 0.15), (x + 6, y0 + th * 0.15)], SNARE, 1.0, 0.7 * n.vel)
                cv.glow_line([(x - 6, y1 - th * 0.15), (x + 6, y0 + th * 0.15)], SNARE * (1.3 * fresh * n.vel), width=1.0)
            elif smp == 'rim':
                cv.circle((x, y0 + 4), 2.0, SNARE, 0.8)
                cv.glow_point((x, y0 + 4), SNARE * (1.2 * fresh), size=2.5)
            elif smp == 'warm-pad':
                ln = self.v * 2.5
                poly = [(x - ln, y0), (x, y0), (x, y1), (x - ln, y1)]
                cv.glow_poly(poly, WINDOW * (0.08 * env(t, n.start, 0.6, 2.5)))
        # Aufnahmekopf
        hx = self.x_head
        cv.fill_poly([(hx - 22, y0 - 36), (hx + 22, y0 - 36), (hx + 13, y0 - 4), (hx - 13, y0 - 4)], hexc('#1a1a22'), 1.0)
        cv.stroke([(hx - 22, y0 - 36), (hx + 22, y0 - 36), (hx + 13, y0 - 4), (hx - 13, y0 - 4)], INK, 1.0, 0.35, closed=True)
        cv.stroke([(hx, y0 - 4), (hx, y1 + 4)], INK, 1.0, 0.10)
        # Bandende und Vorspann
        if x_end < W + 10:
            cv.cover_poly([(x_end, y0 - 2), (W + 2, y0 - 2), (W + 2, y1 + 2), (x_end, y1 + 2)], hexc(self.BG))
            lead = [(x_end, y0), (min(W + 2, x_end + self.leader_len), y0), (min(W + 2, x_end + self.leader_len), y1), (x_end, y1)]
            if x_end + self.leader_len > 0:
                cv.fill_poly(lead, LEADER * 0.06, 1.0)
                cv.stroke(lead, INK, 1.0, 0.25, closed=True)
            # das Ende (Bandanfang des Vorspanns) flattert
            if x_end + self.leader_len < W:
                xe = x_end + self.leader_len
                fl = math.sin(t * 40) * 6
                cv.stroke([(xe, y0), (xe + 30, y0 + fl), (xe + 30, y1 + fl), (xe, y1)], INK, 1.0, 0.2)

        # ---------- Schrift
        self.cap.title(cv, 'SMALL MACHINES  ·  SID/65 + PAULA/68', 'Fensterlicht auf Magnetband',
                       f'{s.bpm} BPM  ·  {s.key}  ·  drei Stimmen, vier Kanäle', t, INK, dur=8.0, y_rel=0.13)
        for j, (name, a, b, _, _) in enumerate(s.sections):
            if j == 0:
                continue
            self.cap.section(cv, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][j], name, t - a, INK)
        if t > s.music_s + 1.5:
            self.cap.credits(cv, [('Fensterlicht auf Magnetband', 'title'),
                                  ('Small Machines', 'name'),
                                  ('SID/65 × PAULA/68', 'small'),
                                  ('Allein und zusammen  ·  Berlin, Oktober 2026', 'small')], t - (s.music_s + 1.5), INK, dur=s.tail - 1.9)
        return self.master_fade(t) if t < 2.0 else 1.0 if t < s.duration - 1.5 else max(0.0, (s.duration - t) / 1.5)

    def vgrad(self, ya, yb, col):
        if not hasattr(self, '_vg'):
            ys = np.arange(self.H, dtype=np.float32)
            g = np.clip((ys - ya) / max(yb - ya, 1), 0, 1) ** 1.5
            self._vg = g[:, None, None]
        self.canvas.emit += self._vg * np.asarray(col, np.float32)
