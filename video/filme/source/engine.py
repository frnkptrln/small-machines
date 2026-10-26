"""
Small Machines — Film-Engine
Partitur (JSON) -> Bilder -> MP4.  numpy + OpenCV, deterministisch.

Bildraum: float32-Canvas in linearem Licht (H, W, 3), RGB.
  canvas.base   : deckende Schicht (Alpha-über-Zeichnen: Tinte, Papier, Blätter)
  canvas.emit   : Leuchtschicht (additiv), bekommt am Ende Glow
Nachbearbeitung: Glow (zwei Radien), Vignette, Tonemapping, Gamma, Korn.
"""
from __future__ import annotations
import json, math, os, subprocess, sys, time
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

SHIFT = 8
SUB = 1 << SHIFT

# --------------------------------------------------------------------------
# Farben
# --------------------------------------------------------------------------
def srgb_to_lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)

def hexc(h, mul=1.0):
    """'#rrggbb' -> lineares RGB (float32, 3)"""
    h = h.lstrip('#')
    c = np.array([int(h[i:i+2], 16) / 255 for i in (0, 2, 4)], np.float32)
    return srgb_to_lin(c) * mul

def mix(a, b, t):
    return a * (1 - t) + b * t

# --------------------------------------------------------------------------
# Partitur
# --------------------------------------------------------------------------
# Nominale Klanglängen der Paula-Samples in Sekunden (die Kanäle sind
# monophon: das nächste Ereignis auf demselben Kanal beendet den Klang).
SAMPLE_LEN = {
    'hard-kick': .35, 'deep-kick': .5, 'soft-kick': .4, 'circuit-kick': .4, 'kick': .4,
    'snare': .3, 'clap': .25, 'rim': .12, 'shaker': .15, 'hat': .1, 'open-hat': .45,
    'tom': .4, 'cowbell': .3, 'blip': .15, 'riser': 1.8,
    'mallet': .6, 'glass': 1.6, 'epiano': 1.8, 'warm-pad': 2.6, 'music-box': 1.2,
    'pluck': .5, 'sub': 1.2, 'hollow-bass': .5, 'choir': 2.5,
}
WAVE_NAME = {16: 'triangle', 32: 'saw', 64: 'pulse', 128: 'noise'}


class Note:
    __slots__ = ('start', 'end', 'machine', 'voice', 'note', 'vel', 'sample', 'wave',
                 'accent', 'slide', 'idx', 'gate', 'step', 'patch', 'sweep', 'pw', 'vibrato')

    def __init__(self, **kw):
        for k in self.__slots__:
            setattr(self, k, kw.get(k))

    @property
    def dur(self):
        return self.end - self.start


class Score:
    def __init__(self, path):
        d = json.load(open(path))
        self.raw = d
        self.title = d.get('title', '')
        self.id = d.get('id', '')
        self.bpm = d['bpm']
        self.bars = d['bars']
        self.tail = d.get('tail', 5)
        self.swing = d.get('swing', 0) or 0
        self.key = d.get('key', '')
        self.step_s = 60 / self.bpm / 4
        self.bar_s = self.step_s * 16
        self.music_s = self.bars * 16 * self.step_s
        self.duration = self.music_s + self.tail
        mixd = d.get('mix', {})
        self.fade_in = mixd.get('fadeIn', 1)
        self.fade_out = mixd.get('fadeOut', 4)
        self.engine = d.get('engine')
        self.voices_def = d.get('voices', [])
        # Abschnitte
        secs = []
        sd = d.get('sections', [])
        for i, s in enumerate(sd):
            if 'start' in s:
                a, b = s['start'], s['end']
            else:
                a = s['bar']
                b = sd[i + 1]['bar'] if i + 1 < len(sd) else self.bars
            secs.append((s['name'], a * self.bar_s, b * self.bar_s, a, b))
        self.sections = secs
        # Ereignisse
        notes = []
        tones = []
        for e in d['events']:
            t = e['type']
            if t == 'tone':
                tones.append((self.swing_at(e['at']) * self.step_s, e))
                continue
            if t not in ('sid', 'paula', 'acid'):
                continue
            start = self.swing_at(e['at']) * self.step_s
            gate = e.get('gate')
            n = Note(start=start, machine=t, voice=e.get('voice', 0), note=e['note'],
                     sample=e.get('sample'), accent=e.get('accent', False),
                     slide=e.get('slide', False), idx=e.get('id'), gate=gate, step=e['at'])
            if t == 'paula':
                n.vel = min(1.0, e.get('volume', 48) / 64)
            elif t == 'acid':
                n.vel = 1.0 if e.get('accent') else .7
            else:
                n.vel = .85
            patch = e.get('patch')
            vdef = None
            n.patch = patch
            n.sweep = e.get('sweep')
            n.vibrato = e.get('vibrato')
            if t == 'sid':
                vdef = patch if patch else (self.voices_def[n.voice] if n.voice < len(self.voices_def) else None)
                n.wave = WAVE_NAME.get(vdef['wave'], 'pulse') if vdef else 'pulse'
                n.pw = vdef.get('pw', 50) if vdef else 50
            # Ende
            if gate is not None:
                n.end = self.swing_at(e['at'] + gate) * self.step_s
            elif t == 'paula':
                n.end = start + SAMPLE_LEN.get(n.sample, .6)
            elif t == 'acid':
                n.end = start + 16 * self.step_s  # ohne Gate: gehalten bis zum nächsten Ereignis
            else:
                n.end = start + 2 * self.step_s
            notes.append(n)
        # Monophone Kanäle: nächstes Ereignis auf demselben Kanal beendet den Klang
        for m in ('paula', 'sid', 'acid'):
            for v in set(n.voice for n in notes if n.machine == m):
                seq = sorted([n for n in notes if n.machine == m and n.voice == v], key=lambda n: n.start)
                for a, b in zip(seq, seq[1:]):
                    if b.start < a.end:
                        a.end = b.start
        notes.sort(key=lambda n: n.start)
        self.notes = notes
        self.tones = tones
        self.starts = np.array([n.start for n in notes], np.float64)
        self.ends = np.array([n.end for n in notes], np.float64)

    def swing_at(self, step):
        whole = math.floor(step)
        part = step - whole
        return whole + part + ((part if whole % 2 == 0 else 1 - part) * self.swing)

    # -- Abfragen ---------------------------------------------------------
    def notes_started_before(self, t):
        k = int(np.searchsorted(self.starts, t, side='right'))
        return self.notes[:k]

    def active(self, t):
        k = int(np.searchsorted(self.starts, t, side='right'))
        return [n for n in self.notes[:k] if n.end > t]

    def section_at(self, t):
        for i, s in enumerate(self.sections):
            if s[1] <= t < s[2]:
                return i, s
        if self.sections and t >= self.sections[-1][2]:
            return len(self.sections) - 1, self.sections[-1]
        return 0, self.sections[0] if self.sections else (0, '', 0, 0, 0, 0)

    def bar_pos(self, t):
        """(Taktnummer float, Position im Takt 0..1)"""
        b = t / self.bar_s
        return b, b - math.floor(b)

    def by(self, **kw):
        out = self.notes
        for k, v in kw.items():
            if isinstance(v, (set, list, tuple)):
                out = [n for n in out if getattr(n, k) in v]
            else:
                out = [n for n in out if getattr(n, k) == v]
        return out


# --------------------------------------------------------------------------
# Canvas
# --------------------------------------------------------------------------
class Canvas:
    def __init__(self, W, H, bg):
        self.W, self.H = W, H
        self.bg = np.asarray(bg, np.float32)
        self.base = np.empty((H, W, 3), np.float32)
        self.base[:] = self.bg
        self.emit = np.zeros((H, W, 3), np.float32)
        self._mask_cache = {}

    def clear(self):
        self.base[:] = self.bg
        self.emit[:] = 0

    # -- Hilfen -----------------------------------------------------------
    @staticmethod
    def _ipts(pts, ox=0, oy=0):
        p = np.asarray(pts, np.float64)
        p = (p - [ox, oy]) * SUB
        return np.round(p).astype(np.int32).reshape(-1, 1, 2)

    def _roi(self, pts, pad=2):
        p = np.asarray(pts, np.float64).reshape(-1, 2)
        x0 = int(math.floor(p[:, 0].min())) - pad
        y0 = int(math.floor(p[:, 1].min())) - pad
        x1 = int(math.ceil(p[:, 0].max())) + pad + 1
        y1 = int(math.ceil(p[:, 1].max())) + pad + 1
        x0 = max(x0, 0); y0 = max(y0, 0); x1 = min(x1, self.W); y1 = min(y1, self.H)
        if x1 <= x0 or y1 <= y0:
            return None
        return x0, y0, x1, y1

    def _blend_mask(self, layer, roi, mask, color, alpha):
        x0, y0, x1, y1 = roi
        sub = layer[y0:y1, x0:x1]
        a = mask[..., None] * alpha
        sub *= (1 - a)
        sub += a * np.asarray(color, np.float32)

    def _add_mask(self, layer, roi, mask, color):
        x0, y0, x1, y1 = roi
        layer[y0:y1, x0:x1] += mask[..., None] * np.asarray(color, np.float32)

    # -- Deckende Formen (Alpha über) --------------------------------------
    def fill_poly(self, pts, color, alpha=1.0, layer=None):
        layer = self.base if layer is None else layer
        roi = self._roi(pts)
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.fillPoly(mask, [self._ipts(pts, x0, y0)], 1.0, cv2.LINE_AA, shift=SHIFT)
        self._blend_mask(layer, roi, mask, color, alpha)

    def cover_poly(self, pts, color):
        """deckender Scherenschnitt: füllt base und löscht darunter liegendes Leuchten"""
        roi = self._roi(pts)
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.fillPoly(mask, [self._ipts(pts, x0, y0)], 1.0, cv2.LINE_AA, shift=SHIFT)
        self._blend_mask(self.base, roi, mask, color, 1.0)
        self.emit[y0:y1, x0:x1] *= (1 - mask)[..., None]

    def fill_polys(self, polys, color, alpha=1.0, layer=None):
        """viele Polygone gleicher Farbe in einem Zug (eine Maske, eine Mischung)"""
        if not polys:
            return
        layer = self.base if layer is None else layer
        allp = np.vstack([np.asarray(p, np.float64).reshape(-1, 2) for p in polys])
        roi = self._roi(allp)
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.fillPoly(mask, [self._ipts(p, x0, y0) for p in polys], 1.0, cv2.LINE_AA, shift=SHIFT)
        self._blend_mask(layer, roi, mask, color, alpha)

    def stroke_polys(self, polys, color, width=1.0, alpha=1.0, closed=False, layer=None):
        if not polys:
            return
        layer = self.base if layer is None else layer
        allp = np.vstack([np.asarray(p, np.float64).reshape(-1, 2) for p in polys])
        roi = self._roi(allp, pad=int(width) + 3)
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.polylines(mask, [self._ipts(p, x0, y0) for p in polys], closed, 1.0, max(1, int(round(width))), cv2.LINE_AA, shift=SHIFT)
        self._blend_mask(layer, roi, mask, color, alpha)

    def stroke(self, pts, color, width=1.0, alpha=1.0, closed=False, layer=None):
        layer = self.base if layer is None else layer
        roi = self._roi(pts, pad=int(width) + 3)
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.polylines(mask, [self._ipts(pts, x0, y0)], closed, 1.0, max(1, int(round(width))), cv2.LINE_AA, shift=SHIFT)
        self._blend_mask(layer, roi, mask, color, alpha)

    def circle(self, c, r, color, alpha=1.0, width=-1, layer=None):
        layer = self.base if layer is None else layer
        pts = [(c[0] - r, c[1] - r), (c[0] + r, c[1] + r)]
        roi = self._roi(pts, pad=max(2, int(abs(width)) + 2))
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.circle(mask, (int(round((c[0] - x0) * SUB)), int(round((c[1] - y0) * SUB))), int(round(r * SUB)), 1.0,
                   -1 if width < 0 else max(1, int(round(width))), cv2.LINE_AA, shift=SHIFT)
        self._blend_mask(layer, roi, mask, color, alpha)

    # -- Leuchtende Formen (additiv) ----------------------------------------
    def glow_poly(self, pts, color):
        roi = self._roi(pts)
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.fillPoly(mask, [self._ipts(pts, x0, y0)], 1.0, cv2.LINE_AA, shift=SHIFT)
        self._add_mask(self.emit, roi, mask, color)

    def glow_line(self, pts, color, width=1.0, closed=False):
        roi = self._roi(pts, pad=int(width) + 3)
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.polylines(mask, [self._ipts(pts, x0, y0)], closed, 1.0, max(1, int(round(width))), cv2.LINE_AA, shift=SHIFT)
        self._add_mask(self.emit, roi, mask, color)

    def glow_circle(self, c, r, color, width=-1):
        pts = [(c[0] - r, c[1] - r), (c[0] + r, c[1] + r)]
        roi = self._roi(pts, pad=max(2, int(abs(width)) + 2))
        if roi is None:
            return
        x0, y0, x1, y1 = roi
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.circle(mask, (int(round((c[0] - x0) * SUB)), int(round((c[1] - y0) * SUB))), int(round(r * SUB)), 1.0,
                   -1 if width < 0 else max(1, int(round(width))), cv2.LINE_AA, shift=SHIFT)
        self._add_mask(self.emit, roi, mask, color)

    def glow_point(self, c, color, size=2.0):
        """weicher Lichtpunkt (gaußförmig), schnell"""
        r = int(math.ceil(size * 3)) + 1
        x0, y0 = int(math.floor(c[0])) - r, int(math.floor(c[1])) - r
        x1, y1 = x0 + 2 * r + 1, y0 + 2 * r + 1
        if x1 <= 0 or y1 <= 0 or x0 >= self.W or y0 >= self.H:
            return
        key = (r, round(size, 2), round(c[0] - math.floor(c[0]), 1), round(c[1] - math.floor(c[1]), 1))
        g = self._mask_cache.get(key)
        if g is None:
            ys, xs = np.mgrid[0:2 * r + 1, 0:2 * r + 1]
            dx = xs - r - (c[0] - math.floor(c[0])); dy = ys - r - (c[1] - math.floor(c[1]))
            g = np.exp(-(dx * dx + dy * dy) / (2 * size * size)).astype(np.float32)
            if len(self._mask_cache) < 4000:
                self._mask_cache[key] = g
        cx0, cy0 = max(x0, 0), max(y0, 0)
        cx1, cy1 = min(x1, self.W), min(y1, self.H)
        sub = g[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
        self.emit[cy0:cy1, cx0:cx1] += sub[..., None] * np.asarray(color, np.float32)

    def radial_light(self, c, radius, color, power=2.0):
        """weicher, großer Lichtschein (für Hintergrundstimmung) – auf Viertelauflösung gerechnet"""
        s = 4
        w, h = self.W // s, self.H // s
        ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
        d = np.sqrt((xs * s - c[0]) ** 2 + (ys * s - c[1]) ** 2) / radius
        g = np.clip(1 - d, 0, 1) ** power
        up = cv2.resize(g, (self.W, self.H), interpolation=cv2.INTER_LINEAR)
        self.emit += up[..., None] * np.asarray(color, np.float32)

    # -- Text ---------------------------------------------------------------
    def text(self, s, xy, font, color, alpha=1.0, anchor='la', tracking=0, layer=None):
        """Text (PIL) als Alpha-Maske einblenden. color linear."""
        if not s:
            return
        layer = self.base if layer is None else layer
        if tracking:
            # Buchstabenabstand von Hand
            x = xy[0]
            total = sum(font.getlength(ch) + tracking for ch in s) - tracking
            if anchor[0] == 'm':
                x -= total / 2
            elif anchor[0] == 'r':
                x -= total
            for ch in s:
                self.text(ch, (x, xy[1]), font, color, alpha, 'l' + anchor[1], 0, layer)
                x += font.getlength(ch) + tracking
            return
        bbox = font.getbbox(s, anchor=anchor)
        pad = 4
        w = bbox[2] - bbox[0] + 2 * pad
        h = bbox[3] - bbox[1] + 2 * pad
        img = Image.new('L', (max(w, 1), max(h, 1)), 0)
        ImageDraw.Draw(img).text((pad - bbox[0], pad - bbox[1]), s, 255, font=font, anchor=anchor)
        m = np.asarray(img, np.float32) / 255
        x0 = int(round(xy[0] + bbox[0] - pad)); y0 = int(round(xy[1] + bbox[1] - pad))
        x1, y1 = x0 + m.shape[1], y0 + m.shape[0]
        cx0, cy0 = max(x0, 0), max(y0, 0); cx1, cy1 = min(x1, self.W), min(y1, self.H)
        if cx1 <= cx0 or cy1 <= cy0:
            return
        sub = m[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
        self._blend_mask(layer, (cx0, cy0, cx1, cy1), sub, color, alpha)

    def glow_text(self, s, xy, font, color, anchor='la', tracking=0):
        tmp = np.zeros_like(self.emit)
        self.text(s, xy, font, color, 1.0, anchor, tracking, layer=tmp)
        self.emit += tmp


# --------------------------------------------------------------------------
# Nachbearbeitung
# --------------------------------------------------------------------------
class Post:
    def __init__(self, W, H, glow=(1.0, 0.6), sigmas=(6, 28), vignette=0.42, grain=0.018,
                 exposure=1.0, seed=7):
        self.W, self.H = W, H
        self.glow = glow
        self.sigmas = sigmas
        self.grain = grain
        self.exposure = exposure
        ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
        rx = (xs - W / 2) / (W / 2); ry = (ys - H / 2) / (H / 2)
        r = np.sqrt(rx * rx * 0.85 + ry * ry)
        self.vig = (1 - vignette * np.clip(r - 0.25, 0, 1.4) ** 2.2)[..., None].astype(np.float32)
        self.rng = np.random.default_rng(seed)
        # Korn als Bank vorab (schneller als jedes Bild neu), bereits in Anzeige-Einheiten (0..1)
        self.noise_bank = [(self.rng.standard_normal((H, W), dtype=np.float32) * grain)[..., None] for _ in range(12)]
        # Tonemapping + Gamma als Tabelle (12 Bit)
        x = np.linspace(0, 1, 65536, dtype=np.float32)
        lin = x * 6.0  # Eingangsbereich 0..6 (nach Belichtung)
        tm = lin / (1 + lin * 0.55)
        tm = np.clip(tm, 0, 1)
        srgb = np.where(tm <= 0.0031308, tm * 12.92, 1.055 * np.power(tm, 1 / 2.4) - 0.055)
        self.lut = srgb.astype(np.float32)

    def render(self, canvas: Canvas, frame_idx=0, fade=1.0, emit_scale=1.0):
        E = canvas.emit
        s = 4
        small = cv2.resize(E, (self.W // s, self.H // s), interpolation=cv2.INTER_AREA)
        g1 = cv2.GaussianBlur(small, (0, 0), self.sigmas[0] / s)
        g2 = cv2.GaussianBlur(small, (0, 0), self.sigmas[1] / s)
        glow = cv2.resize(g1 * self.glow[0] + g2 * self.glow[1], (self.W, self.H), interpolation=cv2.INTER_CUBIC)
        img = E + glow
        if emit_scale != 1.0:
            img *= emit_scale
        img += canvas.base
        img *= self.vig * (self.exposure * fade / 6.0 * 65535.0)
        idx = np.clip(img, 0, 65535).astype(np.uint16)
        out = self.lut[idx]
        if self.grain > 0:
            # Korn vor allem in den Mitteltönen, kaum im Schwarz (spart auch Bitrate)
            w = np.clip(out[..., 1:2] * 5.0, 0.3, 1.0)
            out += self.noise_bank[frame_idx % len(self.noise_bank)] * w
        return np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8)  # RGB


# --------------------------------------------------------------------------
# Typografie
# --------------------------------------------------------------------------
FONT_DIRS = [os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fonts'),
             '/usr/share/fonts', '/usr/local/share/fonts', os.path.expanduser('~/.fonts')]

def find_font(names):
    """Erste vorhandene Schrift in der Reihenfolge von names (Ordner sortiert durchsucht)."""
    found = {}
    wanted = {n.lower(): n for n in names}
    for root in FONT_DIRS:
        for dp, dn, fn in os.walk(root):
            dn.sort()
            for f in sorted(fn):
                n = wanted.get(f.lower())
                if n is not None and n not in found:
                    found[n] = os.path.join(dp, f)
    for n in names:
        if n in found:
            return found[n]
    return None

# Die Schriften, mit denen die Filme im Oktober 2026 gerechnet wurden
# (Debian/Ubuntu: fonts-liberation, fonts-dejavu-core, fonts-unifont).
def font(kind, size):
    cands = {
        'mono': ['LiberationMono-Regular.ttf'],
        'mono-light': ['DejaVuSansMono.ttf'],
        'title': ['DejaVuSans.ttf'],
        'title-bold': ['DejaVuSans-Bold.ttf'],
        'serif': ['DejaVuSerif.ttf'],
        'serif-italic': ['DejaVuSerif-Italic.ttf'],
    }[kind]
    p = find_font(cands)
    if p is None:
        raise SystemExit(f'Schrift fehlt: {cands[0]} (Pakete fonts-liberation, fonts-dejavu-core, fonts-unifont '
                         f'oder die Datei nach video/filme/fonts/ legen)')
    return ImageFont.truetype(p, size)


# --------------------------------------------------------------------------
# Ablauf-Hilfen
# --------------------------------------------------------------------------
def ease_out(x, p=2.2):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** p

def ease_in_out(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)

def smooth(x):
    return ease_in_out(x)

def env(t, start, attack=0.02, decay=0.6, floor=0.0):
    """Hüllkurve: 0 vor start, schneller Anstieg, exponentieller Abfall auf floor."""
    if t < start:
        return 0.0
    a = t - start
    if a < attack:
        return a / attack
    return floor + (1 - floor) * math.exp(-(a - attack) / decay)

def fade_window(t, t_in, dur, t_out):
    """0->1 (t_in), hält, 1->0 (t_out) – für Einblendungen"""
    if t < 0:
        return 0.0
    if t < t_in:
        return smooth(t / t_in) if t_in > 0 else 1.0
    if t < dur - t_out:
        return 1.0
    if t < dur:
        return smooth((dur - t) / t_out) if t_out > 0 else 1.0
    return 0.0


class Caption:
    """Kleine Beschriftungen (Abschnitte, Titel, Abspann)."""
    def __init__(self, W, H, scale=1.0):
        self.W, self.H = W, H
        self.f_small = font('mono', int(26 * scale))
        self.f_tiny = font('mono', int(21 * scale))
        self.f_title = font('title', int(64 * scale))
        self.f_sub = font('title', int(30 * scale))
        self.f_serif = font('serif-italic', int(34 * scale))

    def section(self, canvas, label, name, t_since, color, dur=5.0):
        a = fade_window(t_since, 0.9, dur, 1.6)
        if a <= 0:
            return
        x, y = int(self.W * 0.052), int(self.H * 0.905)
        canvas.text(label, (x, y), self.f_tiny, color, alpha=0.55 * a, anchor='ls', tracking=3)
        canvas.text(name.upper(), (x, y + int(self.H * 0.034)), self.f_small, color, alpha=0.85 * a, anchor='ls', tracking=5)

    def title(self, canvas, over, title, under, t, color, dur=7.0, y_rel=0.14):
        a = fade_window(t, 1.2, dur, 1.8)
        if a <= 0:
            return
        x, y = int(self.W * 0.052), int(self.H * y_rel)
        canvas.text(over, (x, y), self.f_tiny, color, alpha=0.6 * a, anchor='ls', tracking=4)
        canvas.text(title, (x, y + int(self.H * 0.075)), self.f_title, color, alpha=0.92 * a, anchor='ls', tracking=1)
        canvas.text(under, (x, y + int(self.H * 0.115)), self.f_tiny, color, alpha=0.55 * a, anchor='ls', tracking=3)

    def credits(self, canvas, lines, t, color, dur=6.0):
        a = fade_window(t, 1.5, dur, 1.5)
        if a <= 0:
            return
        y = int(self.H * 0.47)
        for i, (txt, kind) in enumerate(lines):
            f = {'small': self.f_tiny, 'title': self.f_sub, 'serif': self.f_serif, 'name': self.f_small}[kind]
            if kind == 'name':
                # Künstlername: Versalien, weit gesperrt
                canvas.text(txt.upper(), (self.W / 2, y), f, color, alpha=0.8 * a, anchor='ms', tracking=7)
                y += int(self.H * 0.06)
                continue
            canvas.text(txt, (self.W / 2, y), f, color, alpha=(0.9 if kind != 'small' else 0.55) * a, anchor='ms',
                        tracking=3 if kind == 'small' else 1)
            y += int(self.H * (0.055 if kind != 'small' else 0.04))


# --------------------------------------------------------------------------
# Video
# --------------------------------------------------------------------------
class VideoOut:
    def __init__(self, path, W, H, fps=30, crf=18, preset='medium', threads=0):
        self.path = path
        cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps),
               '-i', '-', '-an', '-c:v', 'libx264', '-preset', preset, '-crf', str(crf), '-pix_fmt', 'yuv420p',
               '-movflags', '+faststart']
        if threads:
            cmd += ['-threads', str(threads)]
        cmd += [path]
        self.p = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    def write(self, rgb):
        self.p.stdin.write(np.ascontiguousarray(rgb).tobytes())

    def close(self):
        self.p.stdin.close()
        self.p.wait()


def run_film(film_cls, score_path, out_path, W=1920, H=1080, fps=30, frame_range=None, crf=18,
             stills=None, stills_dir=None, preset='medium', **kw):
    """Rendert einen Film. stills: Liste von Zeiten (s) -> PNGs statt Video."""
    score = Score(score_path)
    film = film_cls(score, W, H, fps, **kw)
    post = Post(W, H, **film.post_params())
    n_frames = int(math.ceil(score.duration * fps))
    t0 = time.time()
    if stills is not None:
        os.makedirs(stills_dir, exist_ok=True)
        for ts in stills:
            i = int(round(ts * fps))
            film.canvas.clear()
            fade = film.frame(i / fps, i)
            rgb = post.render(film.canvas, i, fade)
            Image.fromarray(rgb).save(os.path.join(stills_dir, f'{score.id}_{ts:07.2f}.png'))
            print('still', ts, 'ok', flush=True)
        return
    a, b = (0, n_frames) if frame_range is None else (max(0, frame_range[0]), min(n_frames, frame_range[1]))
    # Zustand bis a vorspulen (Filme können Zustand tragen)
    film.warmup(a / fps, fps)
    vo = VideoOut(out_path, W, H, fps, crf=crf, preset=preset)
    for i in range(a, b):
        t = i / fps
        film.canvas.clear()
        fade = film.frame(t, i)
        vo.write(post.render(film.canvas, i, fade))
        if (i - a) % 150 == 0:
            el = time.time() - t0
            done = i - a + 1
            print(f'{score.id}: frame {i}/{n_frames}  {el:.0f}s  ({done / max(el, 1e-6):.1f} fps)  eta {(b - i) / max(done / max(el, 1e-6), 1e-6):.0f}s', flush=True)
    vo.close()
    print('done', out_path, time.time() - t0, flush=True)


class Film:
    """Basisklasse. Unterklassen: frame(t, i) zeichnet auf self.canvas und gibt Gesamt-Fade zurück."""
    BG = '#06070c'

    def __init__(self, score: Score, W, H, fps):
        self.score, self.W, self.H, self.fps = score, W, H, fps
        self.canvas = Canvas(W, H, hexc(self.BG))
        self.cap = Caption(W, H, scale=H / 1080)
        self.rng = np.random.default_rng(1234)

    def post_params(self):
        return {}

    def warmup(self, t, fps):
        pass

    def master_fade(self, t):
        s = self.score
        fi = min(1.0, t / max(s.fade_in, 1e-3))
        fo = min(1.0, (s.duration - t) / max(s.fade_out, 1e-3))
        return math.sin(min(fi, 1) * math.pi / 2) * math.sin(max(min(fo, 1), 0) * math.pi / 2)

    def frame(self, t, i):
        raise NotImplementedError
