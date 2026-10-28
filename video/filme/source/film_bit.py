"""
EIN BIT VON DIR — SID/65 solo, 80 BPM, h-Moll / D-Dur, 48 Takte.

Zwei Lichter weit auseinander in der Dunkelheit – zwei Fenster, zwei Maschinen.
Die Dreiecksmelodie (Stimme 1) spricht von links: jede Note schickt ein Bit als Lichtpunkt
auf einem Bogen hinüber; die Pulsstimme (Stimme 3) antwortet von rechts mit kurzen Bits.
Die gehaltenen Bässe (Stimme 2) sind der Boden des Raums – ein langsames Atmen am Horizont.
Jeder Flug lässt eine feine Spur zurück. Mit der Zeit webt sich zwischen den beiden
eine Brücke aus Bögen. Im Abschnitt „Nähe" rücken die Lichter zusammen; am Ende
bleibt der Abstand – und die Brücke – offen.
"""
import math
import numpy as np
from engine import Film, hexc, mix, smooth, ease_out, ease_in_out, env
from film_neon import sid_env, midi_hz

TAU = 2 * math.pi
INK = hexc('#d9c9a8')
LEFT = hexc('#ffb95a')     # Bernstein
LEFT_E = hexc('#fff0cf')
RIGHT = hexc('#9ed3ff')    # Eis
RIGHT_E = hexc('#eaf7ff')
GROUND = hexc('#5a4a3a')
TRAIL_L = hexc('#c99a5a')
TRAIL_R = hexc('#7fa6c4')

FLY = 0.9  # Flugzeit eines Bits in Sekunden


class Bit(Film):
    BG = '#04040a'

    def __init__(self, score, W, H, fps):
        super().__init__(score, W, H, fps)
        s = self.score
        self.sec = {name: (a, b) for (name, a, b, _, _) in s.sections}
        self.bits = []
        rng = np.random.default_rng(7)
        for n in s.notes:
            if n.voice == 1:
                continue
            side = 0 if n.voice == 0 else 1
            h = (n.note - 66) / 12.0  # Tonhöhe -> Bogenhöhe
            self.bits.append(dict(n=n, side=side, h=h, jit=(rng.random() - 0.5) * 0.06, t=n.start,
                                  dur=min(max(n.dur, 0.25), 2.5)))
        self.bit_starts = np.array([b['t'] for b in self.bits])
        self.bass = [n for n in s.notes if n.voice == 1]
        # Spuren-Schicht (bleibt), wird pro Bild nur addiert
        self.trail = np.zeros((H, W, 3), np.float32)
        self.trail_ptr = 0
        self.trail_done = []

    def post_params(self):
        return dict(glow=(1.0, 0.8), sigmas=(6, 40), vignette=0.5, grain=0.012, exposure=1.0)

    # Positionen der beiden Lichter
    def anchors(self, t):
        W, H = self.W, self.H
        a, b = self.sec['Nähe']
        near = smooth(min(max((t - a) / (b - a), 0.0), 1.0)) if t >= a else 0.0
        sep0, sep1 = 0.30, 0.165
        sep = sep0 + (sep1 - sep0) * near
        y = H * 0.50 + H * 0.02 * math.sin(TAU * t / 23)
        return np.array([W * (0.5 - sep), y]), np.array([W * (0.5 + sep), y])

    def arc_point(self, P0, P1, h, u, jit):
        """Punkt auf einem Bogen von P0 nach P1, Höhe h (Bruchteil der Bildhöhe), u 0..1"""
        mid = (P0 + P1) / 2
        d = np.linalg.norm(P1 - P0)
        up = np.array([0.0, -1.0])
        C = mid + up * (self.H * (0.16 + 0.26 * h) + d * jit)
        return (1 - u) ** 2 * P0 + 2 * (1 - u) * u * C + u ** 2 * P1

    def frame(self, t, i):
        s, cv = self.score, self.canvas
        W, H = self.W, self.H
        L, R = self.anchors(t)
        vdef = s.voices_def

        # Boden / Raum: Bass als Horizontlicht
        bass_lvl = 0.0
        bass_note = 60
        for n in self.bass:
            if n.start - 0.1 <= t < n.end + 3.0:
                lv = sid_env(t, n, vdef[1])
                if lv > bass_lvl:
                    bass_lvl, bass_note = lv, n.note
        hy = H * 0.80
        if bass_lvl > 0.002:
            warm = mix(GROUND, hexc('#8a6a4a'), (bass_note - 38) / 12.0)
            pts = np.array([(W * 0.05, hy), (W * 0.95, hy)])
            cv.glow_line(pts, warm * (0.35 * bass_lvl ** 0.8), width=2.0)
            self.horizon(hy, warm * (0.22 * bass_lvl ** 0.8))
        cv.stroke([(0, hy), (W, hy)], INK, 1.0, 0.05)

        # Spuren der vergangenen Flüge (bleiben) – langsam gebacken
        self.bake_trails(t)
        cv.base += self.trail

        # Bits in Flug + ihre Sender
        k = int(np.searchsorted(self.bit_starts, t, side='right'))
        glow_L = 0.0
        glow_R = 0.0
        recv_L = 0.0
        recv_R = 0.0
        for b in self.bits[max(0, k - 40):k]:
            n = b['n']
            age = t - b['t']
            P0, P1 = (L, R) if b['side'] == 0 else (R, L)
            col, ecol, tcol = (LEFT, LEFT_E, TRAIL_L) if b['side'] == 0 else (RIGHT, RIGHT_E, TRAIL_R)
            lv = sid_env(t, n, vdef[n.voice])
            if b['side'] == 0:
                glow_L += lv
            else:
                glow_R += lv * 0.7
            fly = FLY * (1.0 + 0.5 * b['h'] * (1 if b['side'] == 0 else 0.3))
            if age <= fly:
                u = ease_in_out(age / fly) if b['side'] == 0 else ease_out(age / fly, 1.4)
                P = self.arc_point(P0, P1, max(0.0, b['h'] + 0.5), u, b['jit'])
                br = 0.8 + 0.6 * n.vel
                size = (4.5 if b['side'] == 0 else 3.0) * H / 1080
                cv.glow_point(P, ecol * (1.6 * br), size=size)
                cv.glow_point(P, col * (1.0 * br), size=size * 2.6)
                # kurzer Schweif
                for q in range(1, 7):
                    uu = max(0.0, u - q * 0.018)
                    Pq = self.arc_point(P0, P1, max(0.0, b['h'] + 0.5), uu, b['jit'])
                    cv.glow_point(Pq, col * (0.5 * br * (1 - q / 7)), size=size * (1 - q / 9))
            elif age <= fly + 0.5:
                # Ankunft: der Empfänger leuchtet auf
                a = 1 - (age - fly) / 0.5
                if b['side'] == 0:
                    recv_R += a
                else:
                    recv_L += a

        # Die beiden Lichter
        def lamp(P, col, ecol, base, extra, size):
            cv.glow_point(P, ecol * (1.2 * (base + extra)), size=size * 0.55)
            cv.glow_point(P, col * (0.8 * (base + extra)), size=size * 1.6)
            cv.glow_point(P, col * (0.10 * (base + extra)), size=size * 4.2)
            cv.circle(P, size * 0.42, mix(ecol, col, 0.3), 0.9 * min(1.0, base + extra))
            # feiner Fensterrahmen: ein Rechteck aus Tinte um das Licht
            w, h = size * 2.4, size * 3.0
            cv.stroke([(P[0] - w, P[1] - h), (P[0] + w, P[1] - h), (P[0] + w, P[1] + h), (P[0] - w, P[1] + h)],
                      INK, 1.0, 0.16, closed=True)
            cv.stroke([(P[0], P[1] - h), (P[0], P[1] + h)], INK, 1.0, 0.08)
            cv.stroke([(P[0] - w, P[1]), (P[0] + w, P[1])], INK, 1.0, 0.08)

        on_L = 0.35 + 0.65 * min(1.0, glow_L) + 0.8 * min(1.0, recv_L)
        on_R = 0.30 + 0.65 * min(1.0, glow_R) + 0.8 * min(1.0, recv_R)
        if t < 1.0:
            on_L *= smooth(t)
            on_R *= smooth(max(0.0, t - 0.3))
        lamp(L, LEFT, LEFT_E, on_L, 0.0, 14 * H / 1080)
        lamp(R, RIGHT, RIGHT_E, on_R, 0.0, 12 * H / 1080)

        # Schrift
        self.cap.title(cv, 'SMALL MACHINES  ·  SID/65', 'Ein Bit von dir',
                       f'{s.bpm} BPM  ·  {s.key}  ·  drei Synthesestimmen', t, INK, dur=8.0)
        for j, (name, a, b, _, _) in enumerate(s.sections):
            if j == 0:
                continue
            self.cap.section(cv, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][j], name, t - a, INK)
        if t > s.music_s + 2.0:
            self.cap.credits(cv, [('Ein Bit von dir', 'title'),
                                  ('Small Machines', 'name'),
                                  ('SID/65', 'small'),
                                  ('Allein und zusammen  ·  Berlin, Oktober 2026', 'small')], t - (s.music_s + 2.0), INK, dur=s.tail - 2.4)
        return self.master_fade(t) if t < 2.0 else 1.0 if t < s.duration - 1.5 else max(0.0, (s.duration - t) / 1.5)

    def horizon(self, hy, col):
        import cv2
        if not hasattr(self, '_hz'):
            ys = np.arange(self.H, dtype=np.float32)
            g = np.exp(-np.abs(ys - hy) / (self.H * 0.06))
            g[ys > hy] *= 0.5
            self._hz = g[:, None, None]
        self.canvas.emit += self._hz * np.asarray(col, np.float32)

    def bake_trails(self, t):
        """Flüge, die abgeschlossen sind, werden als feine Linie in die Spurenschicht gezeichnet."""
        import cv2
        from engine import SUB, SHIFT
        while self.trail_ptr < len(self.bits):
            b = self.bits[self.trail_ptr]
            fly = FLY * (1.0 + 0.5 * b['h'] * (1 if b['side'] == 0 else 0.3))
            if b['t'] + fly > t:
                break
            self.trail_ptr += 1
            L, R = self.anchors(b['t'])
            P0, P1 = (L, R) if b['side'] == 0 else (R, L)
            us = np.linspace(0, 1, 40)
            pts = np.array([self.arc_point(P0, P1, max(0.0, b['h'] + 0.5), u, b['jit']) for u in us])
            tcol = TRAIL_L if b['side'] == 0 else TRAIL_R
            ip = np.round(pts * SUB).astype(np.int32).reshape(-1, 1, 2)
            layer = np.zeros((self.H, self.W), np.float32)
            cv2.polylines(layer, [ip], False, 1.0, 1, cv2.LINE_AA, shift=SHIFT)
            self.trail += layer[..., None] * (tcol * (0.028 * (0.6 + 0.6 * b['n'].vel)))

    def warmup(self, t, fps):
        # Spuren bis t aufbauen (mit angenähertem Verblassen)
        self.bake_trails(t)
