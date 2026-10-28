"""
ZWISCHEN ZWEI TAKTEN — SID/65 + PAULA/68, 126 BPM, e-Moll, 64 Takte.

Ein Tracker-Bildschirm in der Dunkelheit – so hätte man dieses Stück 1991 geschrieben.
Sieben Spalten: drei SID-Stimmen links, vier Paula-Kanäle rechts. Jede Zeile ein Sechzehntel,
64 Zeilen ein Pattern, 16 Patterns das Stück. Die Frage des SID steht links, die Antwort der
Marimba rechts. Der Cursor bleibt in der Mitte, die Partitur läuft durch ihn hindurch;
was kommt, steht schon dünn darunter. Hinter dem Text wandern Copper-Bars (ein Gruß an den
Amiga), die Bassdrum lässt sie aufleuchten. „Offene Türen": die beiden Hälften rücken auseinander.
„Halbe Geschwindigkeit": die Zeilen werden höher, der Lauf wird langsamer. „Letzter Zug": die
letzte Zeile, dann bleibt der Bildschirm stehen.
"""
import math
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from engine import Film, hexc, mix, smooth, ease_out, ease_in_out, env, find_font

TAU = 2 * math.pi
INK = hexc('#d9c9a8')
DIM = hexc('#5c574c')
FUTURE = hexc('#3a3833')
CURSOR = hexc('#2a2418')
SIDC = [hexc('#ffb347'), hexc('#ff5a3c'), hexc('#8fd0ff')]
PAC = [hexc('#ffd27a'), hexc('#ffe9b8'), hexc('#d8c8b0'), hexc('#bfe0ff')]
NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-']
ABBR = {'hard-kick': 'KCK', 'hat': 'HAT', 'open-hat': 'OHT', 'clap': 'CLP', 'tom': 'TOM', 'cowbell': 'CBL',
        'riser': 'RSR', 'blip': 'BLP', 'music-box': 'MBX', 'mallet': None, 'epiano': None}
COPPER = [  # Farbverläufe der Balken (Mitte hell)
    [hexc('#3a0d05'), hexc('#c8441a'), hexc('#ffb347'), hexc('#fff2c8'), hexc('#ffb347'), hexc('#c8441a'), hexc('#3a0d05')],
    [hexc('#06142a'), hexc('#1f4f8a'), hexc('#8fd0ff'), hexc('#e8f6ff'), hexc('#8fd0ff'), hexc('#1f4f8a'), hexc('#06142a')],
    [hexc('#2a1a05'), hexc('#8a5a14'), hexc('#e0a84a'), hexc('#fff0c0'), hexc('#e0a84a'), hexc('#8a5a14'), hexc('#2a1a05')],
]


def note_name(n):
    return f'{NAMES[n % 12]}{n // 12 - 1}'


class Takte(Film):
    BG = '#050507'

    def __init__(self, score, W, H, fps):
        super().__init__(score, W, H, fps)
        s = self.score
        self.sec = {name: (a, b) for (name, a, b, _, _) in s.sections}
        self.font = ImageFont.truetype(find_font(['unifont.otf', 'unifont.ttf']), int(27 * H / 1080))
        self.font_small = ImageFont.truetype(find_font(['unifont.otf', 'unifont.ttf']), int(20 * H / 1080))
        self.rh = 27 * H / 1080           # Zeilenhöhe
        self.cw = 150 * W / 1920          # Spaltenbreite
        self.steps = s.bars * 16
        # Zellen: (step, channel) -> (token, note)
        self.cells = {}
        self.cell_onset = {}
        for n in s.notes:
            st = int(round(n.step))
            if n.machine == 'sid':
                ch = n.voice
                tok = note_name(n.note)
            else:
                ch = 3 + n.voice
                tok = ABBR.get(n.sample) or note_name(n.note)
            self.cells[(st, ch)] = (tok, n)
        self.tok_cache = {}
        # Copper-Bars
        self.bars = [dict(y0=0.3, amp=0.22, spd=0.11, ph=0.0, h=52, pal=0),
                     dict(y0=0.6, amp=0.25, spd=0.083, ph=2.1, h=40, pal=1),
                     dict(y0=0.45, amp=0.3, spd=0.067, ph=4.0, h=30, pal=2)]
        self.kicks = [n for n in s.notes if n.sample == 'hard-kick']
        self.kick_t = np.array([n.start for n in self.kicks])
        self.bass = [n for n in s.notes if n.machine == 'sid' and n.voice == 1]

    def post_params(self):
        return dict(glow=(0.8, 0.5), sigmas=(5, 30), vignette=0.42, grain=0.012, exposure=1.0)

    def token_mask(self, tok, small=False):
        key = (tok, small)
        m = self.tok_cache.get(key)
        if m is None:
            f = self.font_small if small else self.font
            bbox = f.getbbox(tok)
            img = Image.new('L', (bbox[2] + 2, bbox[3] + 2), 0)
            ImageDraw.Draw(img).text((1, 1), tok, 255, font=f)
            m = np.asarray(img, np.float32) / 255
            self.tok_cache[key] = m
        return m

    def put(self, tok, x, y, color, alpha, glow=0.0, small=False):
        m = self.token_mask(tok, small)
        h, w = m.shape
        x0, y0 = int(round(x)), int(round(y - h / 2))
        x1, y1 = x0 + w, y0 + h
        cx0, cy0 = max(x0, 0), max(y0, 0); cx1, cy1 = min(x1, self.W), min(y1, self.H)
        if cx1 <= cx0 or cy1 <= cy0:
            return
        sub = m[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
        self.canvas._blend_mask(self.canvas.base, (cx0, cy0, cx1, cy1), sub, color, alpha)
        if glow > 0:
            self.canvas.emit[cy0:cy1, cx0:cx1] += sub[..., None] * (np.asarray(color, np.float32) * glow)

    def frame(self, t, i):
        s, cv = self.score, self.canvas
        W, H = self.W, self.H
        tm = min(t, s.music_s)
        step_f = tm / s.step_s
        cur = min(int(step_f), self.steps - 1)

        def sec_w(name, ramp=2.0):
            a, b = self.sec[name]
            if t < a - ramp or t > b + ramp:
                return 0.0
            return smooth((t - (a - ramp)) / ramp) * smooth(((b + ramp) - t) / ramp) if (t < a or t > b) else 1.0
        w_tuer = sec_w('Offene Türen', 3.0)
        w_halb = sec_w('Halbe Geschwindigkeit', 3.0)
        rh = self.rh * (1 + 0.9 * w_halb)
        gap = W * (0.06 + 0.16 * w_tuer)
        # Spaltenpositionen
        left_w = 3 * self.cw
        right_w = 4 * self.cw
        total = left_w + gap + right_w
        x_left = (W - total) / 2
        xs = [x_left + k * self.cw for k in range(3)] + [x_left + left_w + gap + k * self.cw for k in range(4)]
        x_row = x_left - 110 * W / 1920
        yc = H * 0.5

        # ---- Copper-Bars (hinter allem)
        kick = 0.0
        k = int(np.searchsorted(self.kick_t, t, side='right'))
        for n in self.kicks[max(0, k - 2):k]:
            kick += env(t, n.start, 0.005, 0.12) * n.vel
        bass_lvl = 0.0
        for n in self.bass[-400:]:
            if n.start <= t < n.end + 0.3:
                from film_neon import sid_env
                bass_lvl = max(bass_lvl, sid_env(t, n, s.voices_def[1]))
        end_fade = 1.0 if t < s.music_s + 1.0 else max(0.0, 1 - (t - s.music_s - 1.0) / 3.0)
        for b in self.bars:
            y = H * (b['y0'] + b['amp'] * math.sin(TAU * (t * b['spd'] + b['ph'] / TAU)))
            hh = b['h'] * H / 1080 * (1 + 0.5 * kick)
            self.copper(y, hh, COPPER[b['pal']], (0.22 + 0.35 * kick + 0.15 * bass_lvl) * (1 - 0.5 * w_halb))

        # ---- Cursorzeile
        cv.fill_poly([(x_row - 10, yc - rh / 2), (xs[-1] + self.cw, yc - rh / 2), (xs[-1] + self.cw, yc + rh / 2), (x_row - 10, yc + rh / 2)],
                     CURSOR, 0.85 * end_fade)
        cv.stroke([(x_row - 10, yc - rh / 2), (xs[-1] + self.cw, yc - rh / 2)], INK, 1.0, 0.25 * end_fade)
        cv.stroke([(x_row - 10, yc + rh / 2), (xs[-1] + self.cw, yc + rh / 2)], INK, 1.0, 0.25 * end_fade)

        # ---- Kopfzeile
        heads = ['SID 1', 'SID 2', 'SID 3', 'PAULA 1', 'PAULA 2', 'PAULA 3', 'PAULA 4']
        for ch, hname in enumerate(heads):
            self.put(hname, xs[ch], H * 0.045, INK, 0.5 * end_fade, small=True)
        cv.stroke([(x_row - 10, H * 0.07), (xs[-1] + self.cw, H * 0.07)], INK, 1.0, 0.18 * end_fade)
        pat = cur // 64
        si, sec = s.section_at(tm)
        y_status = H * 0.955
        cv.stroke([(x_row - 10, H * 0.93), (xs[-1] + self.cw, H * 0.93)], INK, 1.0, 0.18 * end_fade)
        self.put(f'PATTERN {pat:02X}/0F   ROW {cur % 64:02X}   BPM {s.bpm}', x_row - 10, y_status, INK, 0.5 * end_fade, small=True)
        self.put(f'; {sec[0]}', xs[3], y_status, DIM, 0.95 * end_fade, small=True)
        y_top, y_bot = H * 0.085, H * 0.915

        # ---- Zeilen
        n_vis = int(H / rh) + 2
        for r in range(cur - n_vis // 2, cur + n_vis // 2 + 1):
            if r < 0 or r >= self.steps:
                continue
            y = yc + (r - cur) * rh
            if y < y_top + rh * 0.5 or y > y_bot - rh * 0.5:
                continue
            is_cur = (r == cur)
            past = r < cur
            # Zeilennummer (hex innerhalb des Patterns), Taktanfänge heller
            rn = r % 64
            a_num = 0.55 if rn % 16 == 0 else (0.35 if rn % 4 == 0 else 0.2)
            if not past and not is_cur:
                a_num *= 0.55
            self.put(f'{rn:02X}', x_row, y, INK if is_cur else DIM, a_num * end_fade, small=True)
            if rn % 16 == 0 and not is_cur:
                cv.stroke([(x_row - 10, y - rh / 2), (xs[-1] + self.cw, y - rh / 2)], INK, 1.0, 0.06 * end_fade)
            for ch in range(7):
                cell = self.cells.get((r, ch))
                if cell is None:
                    self.put('···', xs[ch], y, FUTURE if not past else DIM, (0.35 if past or is_cur else 0.22) * end_fade)
                    continue
                tok, n = cell
                col = SIDC[ch] if ch < 3 else PAC[ch - 3]
                if past or is_cur:
                    age = t - n.start
                    fresh = math.exp(-age / (0.9 if ch < 3 else 0.6)) if age >= 0 else 0.0
                    base_a = 0.75 if is_cur else 0.55
                    c = mix(mix(INK, col, 0.6), col, fresh)
                    self.put(tok, xs[ch], y, c, (base_a + 0.25 * fresh) * end_fade, glow=1.4 * fresh * n.vel)
                else:
                    self.put(tok, xs[ch], y, mix(FUTURE, col, 0.25), 0.5 * end_fade)
        # Kanaltrenner
        for ch in range(1, 7):
            if ch == 3:
                continue
            xg = xs[ch] - 10 * W / 1920
            cv.stroke([(xg, H * 0.07), (xg, H * 0.93)], INK, 1.0, 0.07 * end_fade)
        # Scanlines (leicht)
        if not hasattr(self, '_scan'):
            ys = np.arange(H)
            self._scan = (1 - 0.07 * (ys % 3 == 0))[:, None, None].astype(np.float32)
        cv.base *= self._scan

        # ---- Schrift
        from engine import fade_window
        a_t = fade_window(t, 1.2, 8.0, 1.8)
        if a_t > 0:
            bx0, by0 = W * 0.035, H * 0.60
            cv.fill_poly([(bx0, by0), (W * 0.47, by0), (W * 0.47, H * 0.80), (bx0, H * 0.80)], hexc('#07070a'), 0.92 * a_t)
            cv.stroke([(bx0, by0), (W * 0.47, by0), (W * 0.47, H * 0.80), (bx0, H * 0.80)], INK, 1.0, 0.3 * a_t, closed=True)
        self.cap.title(cv, 'SMALL MACHINES  ·  SID/65 + PAULA/68', 'Zwischen zwei Takten',
                       f'{s.bpm} BPM  ·  {s.key}  ·  Frage und Antwort', t, INK, dur=8.0, y_rel=0.655)
        if t > s.music_s + 1.5:
            self.cap.credits(cv, [('Zwischen zwei Takten', 'title'),
                                  ('Small Machines', 'name'),
                                  ('SID/65 × PAULA/68', 'small'),
                                  ('Allein und zusammen  ·  Berlin, Oktober 2026', 'small')], t - (s.music_s + 1.5), INK, dur=s.tail - 1.9)
        return self.master_fade(t) if t < 1.5 else 1.0 if t < s.duration - 1.5 else max(0.0, (s.duration - t) / 1.5)

    def copper(self, y, hh, pal, gain):
        """horizontaler Farbbalken mit Verlauf (Copper-Bar)"""
        H, W = self.H, self.W
        y0 = int(max(0, y - hh)); y1 = int(min(H, y + hh))
        if y1 <= y0:
            return
        ys = (np.arange(y0, y1) - (y - hh)) / (2 * hh)  # 0..1
        n = len(pal) - 1
        pos = ys * n
        idx = np.clip(pos.astype(int), 0, n - 1)
        frac = (pos - idx)[:, None]
        p = np.array(pal, np.float32)
        col = p[idx] * (1 - frac) + p[idx + 1] * frac
        # horizontale Abschattung zu den Rändern
        if not hasattr(self, '_hx'):
            xs = np.linspace(-1, 1, W, dtype=np.float32)
            self._hx = (1 - 0.6 * xs ** 2)[None, :, None]
        self.canvas.emit[y0:y1] += col[:, None, :] * gain * 0.35 * self._hx
        self.canvas.base[y0:y1] += col[:, None, :] * gain * 0.25 * self._hx
