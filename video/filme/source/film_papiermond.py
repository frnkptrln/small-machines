"""
PAPIERMOND — PAULA/68 solo, 94 BPM, f-Moll, 56 Takte.

Ein Scherenschnitt-Diorama: Nachthimmel aus Papier, dahinter Licht. Ein Papiermond zieht
seine Bahn über eine Dächersilhouette; wir sehen durch ein Fenster hinaus.
Jede Taste (epiano) stanzt ein Loch in den Mond – links nach rechts im Lauf des Stücks,
Tonhöhe = Höhe im Mond. So nimmt der Mond zu: aus Noten. Die gezupften Antworten (pluck)
zünden Fenster in den Häusern. Der Subbass lässt das Licht hinter dem Papier atmen,
die Bassdrum rüttelt an den Papierschichten, der Shaker streut Papierstaub.
„Schwerelos": gläserne Kreise steigen auf. „Gute Nacht": die Vorhänge schließen sich.
"""
import math
import numpy as np
import cv2
from engine import Film, hexc, mix, smooth, ease_out, ease_in_out, env

TAU = 2 * math.pi
INK = hexc('#d9c9a8')
PAPER = hexc('#e9dcb8')
MOONLIGHT = hexc('#fff3d0')
WINDOW = hexc('#ffc46a')
BLACK = hexc('#020204')
BACKLAYER = hexc('#0b0d18')
SKY = hexc('#070912')
GLASS = hexc('#cfe6ff')


class Papiermond(Film):
    BG = '#070912'

    def __init__(self, score, W, H, fps):
        super().__init__(score, W, H, fps)
        s = self.score
        self.sec = {name: (a, b) for (name, a, b, _, _) in s.sections}
        self.R = H * 0.165
        rng = np.random.default_rng(21)
        # Löcher im Mond (epiano)
        self.holes = []
        for n in s.notes:
            if n.sample == 'epiano':
                u = n.start / s.music_s
                py = (n.note - 63) / 14.0
                self.holes.append(dict(n=n, ox=-0.84 + 1.68 * u + (rng.random() - 0.5) * 0.03,
                                       oy=0.62 - 1.24 * py + (rng.random() - 0.5) * 0.05,
                                       r=(1.8 + 2.2 * n.vel) * H / 1080 * (0.9 + 0.3 * rng.random())))
        self.hole_t = np.array([h['n'].start for h in self.holes])
        # Stadt: zwei Silhouetten-Schichten
        self.city_back = self.make_city(rng, H * 0.58, H * 0.10, 14, W)
        self.city_front = self.make_city(rng, H * 0.70, H * 0.13, 9, W)
        # Fenster der Häuser (pluck) – Plätze auf der vorderen Silhouette
        self.windows = []
        for n in s.notes:
            if n.sample == 'pluck':
                px = (n.note - 68) / 12.0
                x = W * (0.08 + 0.84 * px) + (rng.random() - 0.5) * W * 0.05
                hidx = min(len(self.city_front) - 1, max(0, int(x / W * len(self.city_front))))
                bx0, bx1, by = self.city_front[hidx]
                x = min(max(x, bx0 + 12), bx1 - 12)
                y = by + H * 0.03 + rng.random() * (H * 0.92 - by - H * 0.06)
                self.windows.append(dict(n=n, x=x, y=y, w=(5 + 3 * rng.random()) * W / 1920, h=(8 + 4 * rng.random()) * H / 1080))
        self.window_t = np.array([w['n'].start for w in self.windows])
        # Sterne (feste Löcher im Himmel)
        self.stars = np.stack([rng.random(70) * W, rng.random(70) * H * 0.55, 0.4 + rng.random(70) * 0.8], axis=1)
        # Staub (shaker)
        self.dust = [n for n in s.notes if n.sample == 'shaker']
        self.dust_t = np.array([n.start for n in self.dust])
        self.dust_rng = {n.idx: np.random.default_rng(300 + n.idx) for n in self.dust}
        self.glass = [n for n in s.notes if n.sample == 'glass']
        self.pads = [n for n in s.notes if n.sample == 'warm-pad']
        self.subs = [n for n in s.notes if n.sample == 'sub']
        self.kicks = [n for n in s.notes if n.sample == 'deep-kick']
        self.snares = [n for n in s.notes if n.sample == 'snare']
        self.rims = [n for n in s.notes if n.sample == 'rim']
        self.mbox = [n for n in s.notes if n.sample == 'music-box']

    def post_params(self):
        return dict(glow=(0.8, 0.6), sigmas=(6, 36), vignette=0.5, grain=0.014, exposure=1.0)

    @staticmethod
    def make_city(rng, base_y, var, n, W):
        """Liste von Häusern (x0, x1, Dachhöhe y)"""
        xs = np.sort(rng.random(n - 1)) * W
        edges = [0] + list(xs) + [W]
        out = []
        for a, b in zip(edges, edges[1:]):
            out.append((a, b, base_y - rng.random() * var))
        return out

    def moon_pos(self, t):
        s = self.score
        p = min(max(t / s.music_s, 0.0), 1.0)
        a, b = self.sec['Schwerelos']
        w_free = smooth(min(max((t - a) / 4.0, 0), 1)) * smooth(min(max((b + 2 - t) / 4.0, 0), 1)) if t > a - 1 else 0.0
        x = self.W * (0.30 + 0.40 * p)
        y = self.H * (0.66 - 0.40 * math.sin(math.pi * p)) - self.H * 0.03 * w_free
        return np.array([x, y]), w_free

    def city_poly(self, city, shift, bottom):
        pts = [(city[0][0] + shift, bottom)]
        for (a, b, y) in city:
            pts += [(a + shift, y), (b + shift, y)]
        pts.append((city[-1][1] + shift, bottom))
        return pts

    def frame(self, t, i):
        s, cv = self.score, self.canvas
        W, H = self.W, self.H
        M, w_free = self.moon_pos(t)
        R = self.R

        # Rütteln durch Bassdrum (Papierschichten mit Parallaxe)
        jolt = 0.0
        for n in self.kicks:
            if 0 <= t - n.start < 0.3:
                jolt += 3.0 * env(t, n.start, 0.01, 0.09) * n.vel
        jx = jolt * math.sin(t * 70)

        # Hintergrundlicht (Pads) und Atmen (Sub)
        back = 0.0
        for n in self.pads:
            if n.start - 0.5 <= t < n.end + 2.0:
                back += env(t, n.start, 0.8, 1.8) * 0.5
        breath = 0.0
        for n in self.subs:
            if n.start <= t < n.end + 0.6:
                breath = max(breath, env(t, n.start, 0.05, 0.9) * (0.5 + 0.5 * n.vel))
        # Himmel: oben dunkler, am Horizont ein Hauch Stadtlicht
        if not hasattr(self, '_sky'):
            ys = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
            top, hor = hexc('#04050c'), hexc('#121428')
            self._sky = (top * (1 - ys) + hor * ys) - hexc(self.BG)
            self._sky += (np.clip((ys - 0.45) / 0.25, 0, 1) ** 2) * hexc('#2a1e14') * 0.35
        cv.base += self._sky
        self.backlight(M, R * 2.1, MOONLIGHT * (0.028 + 0.03 * breath + 0.10 * back))

        # Sterne
        for (sx, sy, sb) in self.stars:
            tw = 0.7 + 0.3 * math.sin(t * 1.3 + sx)
            cv.glow_point((sx, sy), PAPER * (0.12 * sb * tw), size=1.2 * H / 1080)
        # Snare: ein Stern blitzt
        for n in self.snares:
            if 0 <= t - n.start < 0.25:
                k = n.idx % len(self.stars)
                sx, sy, sb = self.stars[k]
                cv.glow_point((sx, sy), MOONLIGHT * (1.4 * (1 - (t - n.start) / 0.25)), size=2.5 * H / 1080)
        # Sternschnuppe (music-box)
        for n in self.mbox:
            if 0 <= t - n.start < 1.6:
                u = (t - n.start) / 1.6
                x0, y0 = W * 0.15 + (n.idx % 7) * W * 0.1, H * 0.12
                P = np.array([x0 + u * W * 0.25, y0 + u * H * 0.12])
                cv.glow_point(P, MOONLIGHT * (1.2 * (1 - u)), size=2.5 * H / 1080)
                cv.glow_line([P - [W * 0.03, H * 0.0144], P], MOONLIGHT * (0.4 * (1 - u)), width=1.0)

        # Mond aus Papier (durchscheinend)
        cv.circle(M, R, hexc('#f1dfb4') * 0.085, 1.0)
        cv.circle(M, R, INK, 0.3, width=1)
        cv.glow_circle(M, R * 0.985, MOONLIGHT * (0.05 + 0.06 * breath))
        # Löcher (zunehmender Mond aus Noten)
        k = int(np.searchsorted(self.hole_t, t, side='right'))
        for h in self.holes[:k]:
            P = M + np.array([h['ox'], h['oy']]) * R
            age = t - h['n'].start
            fresh = env(t, h['n'].start, 0.02, 1.2)
            r = h['r'] * (0.6 + 0.4 * ease_out(age / 0.15))
            cv.circle(P, r, MOONLIGHT * 0.9, 1.0)
            cv.glow_point(P, MOONLIGHT * (0.35 + 0.25 * breath + 1.6 * fresh), size=r * 0.9)
        # Schwerelos: gläserne Kreise steigen
        for n in self.glass:
            age = t - n.start
            if 0 <= age < 9.0:
                u = age / 9.0
                rng = np.random.default_rng(900 + n.idx)
                x = W * (0.25 + 0.5 * rng.random()) + math.sin(age * 0.8 + n.idx) * W * 0.012
                y = H * (0.75 - 0.55 * u)
                rr = (10 + 14 * rng.random()) * H / 1080
                a = env(t, n.start, 0.4, 3.0)
                cv.circle((x, y), rr, GLASS, 0.3 * (1 - u) * a, width=1)
                cv.glow_circle((x, y), rr, GLASS * (0.22 * (1 - u) * a), width=1)
                cv.glow_point((x - rr * 0.35, y - rr * 0.35), GLASS * (0.6 * (1 - u) * a), size=1.5 * H / 1080)

        # Stadt hinten / vorn (Scherenschnitt)
        cv.cover_poly(self.city_poly(self.city_back, jx * 0.4, H), BACKLAYER)
        cv.cover_poly(self.city_poly(self.city_front, jx * 0.8, H), BLACK)
        # Schornsteine
        for (a, b, y) in self.city_front[::2]:
            cx = a + (b - a) * 0.72 + jx * 0.8
            cv.cover_poly([(cx - 7, y), (cx + 7, y), (cx + 7, y - 22 * H / 1080), (cx - 7, y - 22 * H / 1080)], BLACK)
        # Fenster (pluck)
        k = int(np.searchsorted(self.window_t, t, side='right'))
        for w in self.windows[:k]:
            age = t - w['n'].start
            a = env(t, w['n'].start, 0.03, 2.2, 0.0)
            if a < 0.01:
                continue
            x, y = w['x'] + jx * 0.8, w['y']
            cv.fill_poly([(x - w['w'], y - w['h']), (x + w['w'], y - w['h']), (x + w['w'], y + w['h']), (x - w['w'], y + w['h'])],
                         WINDOW * (0.4 + 0.5 * a), 1.0)
            cv.glow_point((x, y), WINDOW * (0.9 * a * w['n'].vel), size=w['w'] * 1.6)
        # Rim: Punkt am Fensterrahmen
        for n in self.rims:
            if 0 <= t - n.start < 0.3:
                a = 1 - (t - n.start) / 0.3
                cv.glow_point((W * 0.5, H * 0.09), INK * (0.8 * a), size=3 * H / 1080)

        # Papierstaub (shaker)
        k = int(np.searchsorted(self.dust_t, t, side='right'))
        for n in self.dust[max(0, k - 12):k]:
            age = t - n.start
            if age > 1.4:
                continue
            rng = self.dust_rng[n.idx]
            rng = np.random.default_rng(300 + n.idx)
            for q in range(5):
                x = W * (0.1 + 0.8 * rng.random()); y = H * (0.2 + 0.5 * rng.random())
                vx, vy = (rng.random() - 0.5) * 30, -10 - 20 * rng.random()
                P = (x + vx * age, y + vy * age)
                cv.glow_point(P, PAPER * (0.5 * (1 - age / 1.4) * n.vel), size=1.1 * H / 1080)

        # Fensterrahmen im Vordergrund + Vorhänge
        fx, fy = W * 0.045, H * 0.07
        frame_col = BLACK
        cv.cover_poly([(0, 0), (W, 0), (W, fy), (0, fy)], frame_col)
        cv.cover_poly([(0, H - fy * 0.6), (W, H - fy * 0.6), (W, H), (0, H)], frame_col)
        cv.cover_poly([(0, 0), (fx, 0), (fx, H), (0, H)], frame_col)
        cv.cover_poly([(W - fx, 0), (W, 0), (W, H), (W - fx, H)], frame_col)
        # Sprossen
        cv.cover_poly([(W * 0.5 - 6, 0), (W * 0.5 + 6, 0), (W * 0.5 + 6, H), (W * 0.5 - 6, H)], frame_col)
        cv.cover_poly([(0, H * 0.40 - 5), (W, H * 0.40 - 5), (W, H * 0.40 + 5), (0, H * 0.40 + 5)], frame_col)
        # Vorhänge: Gute Nacht
        a, b = self.sec['Gute Nacht']
        close = smooth(min(max((t - a - 2.0) / (b - a - 2.0), 0.0), 1.0)) if t > a else 0.0
        if close > 0:
            cw = W * 0.5 * close
            curtain = hexc('#06060b')
            cv.cover_poly(self.curtain_poly(0, cw, t), curtain)
            cv.cover_poly(self.curtain_poly(W, W - cw, t), curtain)
        # Schwerelos: der Rahmen weicht ein wenig zurück (nur Andeutung über Vignette)

        # Schrift
        self.cap.title(cv, 'SMALL MACHINES  ·  PAULA/68', 'Papiermond',
                       f'{s.bpm} BPM  ·  {s.key}  ·  vier Samplekanäle', t, INK, dur=8.0, y_rel=0.16)
        for j, (name, a, b, _, _) in enumerate(s.sections):
            if j == 0:
                continue
            self.cap.section(cv, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][j], name, t - a, INK)
        if t > s.music_s + 1.2:
            self.cap.credits(cv, [('Papiermond', 'title'),
                                  ('Small Machines', 'name'),
                                  ('PAULA/68', 'small'),
                                  ('Allein und zusammen  ·  Berlin, Oktober 2026', 'small')], t - (s.music_s + 1.2), INK, dur=s.tail - 1.6)
        return self.master_fade(t) if t < 2.0 else 1.0 if t < s.duration - 1.5 else max(0.0, (s.duration - t) / 1.5)

    def curtain_poly(self, x_edge, x_inner, t):
        H = self.H
        pts = [(x_edge, 0)]
        n = 14
        for k in range(n + 1):
            y = H * k / n
            wob = math.sin(y * 0.02 + t * 0.7) * 6 + math.sin(y * 0.05) * 4
            pts.append((x_inner + wob, y))
        pts.append((x_edge, H))
        return pts

    def backlight(self, c, radius, col):
        if not hasattr(self, '_bl_d'):
            s = 4
            ys, xs = np.mgrid[0:self.H // s, 0:self.W // s].astype(np.float32)
            self._bl_xy = (xs * s, ys * s)
        xs, ys = self._bl_xy
        d = np.sqrt((xs - c[0]) ** 2 + (ys - c[1]) ** 2) / radius
        g = np.clip(1 - d, 0, 1) ** 2.6
        up = cv2.resize(g, (self.W, self.H), interpolation=cv2.INTER_LINEAR)
        self.canvas.emit += up[..., None] * np.asarray(col, np.float32)
