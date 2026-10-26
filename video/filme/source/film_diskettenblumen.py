"""
DISKETTENBLUMEN — PAULA/68 solo, 132 BPM, c-Moll, 64 Takte.
Eine Blume, die aus der Nabe einer Diskette wächst.

Zeit läuft als Winkel: acht Takte = eine Umdrehung, der Radius wächst mit dem Stück.
Jedes Sample-Ereignis wird ein Blütenblatt an der Stelle, an der der Lesekopf gerade steht.
Wiederholung in der Musik wird so zu Symmetrie in der Blume.

  hollow-bass  -> Kelchblätter, nach innen, Kupfer
  mallet       -> Blütenblätter, Gold (Fragen)
  glass        -> schmale Eisblätter (Antworten)
  hard-kick    -> Lichtring aus der Nabe, Saftpuls
  hat/open-hat -> Pollen, die nach außen fliegen
  clap         -> kurzer heller Strich am Rand
  tom          -> Glutblätter
  epiano/pad   -> breite, durchscheinende Blätter (Zwischenraum)
  music-box    -> kleine Sterne (Laufwerk / Auswerfen)
  riser        -> der Kopf sucht: eine Linie wird hell
Am Ende wird die Diskette ausgeworfen.
"""
import math
import numpy as np
from engine import Film, hexc, mix, env, ease_out, ease_in_out, smooth, fade_window

TAU = 2 * math.pi

INK = hexc('#d9c9a8')
INK_DIM = hexc('#8d8470')
GOLD = hexc('#e2a94a')
GOLD_E = hexc('#ffc868')
ICE = hexc('#b9e3ff')
ICE_E = hexc('#cfefff')
COPPER = hexc('#9c4f24')
COPPER_E = hexc('#ff8a3c')
EMBER = hexc('#d8482a')
EMBER_E = hexc('#ff6a3a')
POLLEN = hexc('#ffe6b0')
LEAF = hexc('#8f9a6a')
PAD = hexc('#6d8894')
RING = hexc('#ffb070')
CLAP = hexc('#fff2d0')
HUB = hexc('#1c1f2b')
HUB_HI = hexc('#2b2f40')
STAR = hexc('#fff6e0')
GHOST = hexc('#8396ad')  # Farbe, zu der alte Blätter abkühlen (Erinnerung)
GHOSTS = {'mallet': hexc('#8a99ad'), 'glass': hexc('#aac2d8'), 'hollow-bass': hexc('#6e7280'), 'sub': hexc('#6e7280'),
          'tom': hexc('#8d7079'), 'epiano': hexc('#66767a'), 'warm-pad': hexc('#5e707c')}

TURN_BARS = 8  # Takte pro Umdrehung


class Diskettenblumen(Film):
    BG = '#06070c'

    def __init__(self, score, W, H, fps):
        super().__init__(score, W, H, fps)
        s = self.score
        self.rho0 = 0.17
        self.turn_s = s.bar_s * TURN_BARS
        self.center = np.array([W / 2, H / 2 + H * 0.01])
        self.sec_index = {name: (a, b) for (name, a, b, _, _) in s.sections}
        self.t_eject = s.music_s - 0.02
        # Blattdefinitionen je Note vorbereiten
        self.items = []
        rng = np.random.default_rng(99)
        for n in s.notes:
            it = self.make_item(n, rng)
            if it:
                self.items.append(it)
        self.items.sort(key=lambda d: d['t'])
        self.item_starts = np.array([d['t'] for d in self.items])
        # Back-Schicht (RGBA, vormultipliziert) im Scheibenraum
        self.Sb = 700.0 * (H / 1080)
        self.bake_size = int(1.2 * self.Sb * 2) + 2
        self.bake = np.zeros((self.bake_size, self.bake_size, 4), np.float32)
        self.bake_center = np.array([self.bake_size / 2, self.bake_size / 2])
        self.cool_list = sorted([d for d in self.items if d['kind'] == 'petal'], key=lambda d: d['t'] + d['cool'])
        self.cool_ptr = 0
        self.t_now = 0.0

    def post_params(self):
        return dict(glow=(0.9, 0.55), sigmas=(5, 30), vignette=0.45, grain=0.012, exposure=1.0)

    # ---------------------------------------------------------------- Zeit -> Scheibe
    def theta(self, tm):
        return -math.pi / 2 + TAU * (tm / self.turn_s)

    def rho(self, tm):
        return self.rho0 + (1 - self.rho0) * min(max(tm, 0), self.score.music_s) / self.score.music_s

    def scale(self, t):
        """Pixel je Scheibeneinheit – Kamera zieht sich langsam zurück"""
        p = min(max(t / self.score.music_s, 0), 1)
        px_frontier = 150 + (432 - 150) * (p ** 0.85)
        return px_frontier / self.rho(min(t, self.score.music_s)) * (self.H / 1080)

    # ---------------------------------------------------------------- Noten -> Blätter
    def make_item(self, n, rng):
        tm = n.start
        th = self.theta(tm)
        rh = self.rho(tm)
        smp = n.sample
        pitch = (n.note - 78) / 8.0  # -1..1 für 70..86
        jr = np.random.default_rng(5000 + (n.idx or 0))
        jit_L = 1 + (jr.random() - 0.5) * 0.22
        jit_w = 1 + (jr.random() - 0.5) * 0.3
        jit_c = (jr.random() - 0.5) * 0.08
        base = dict(t=tm, th=th, rh=rh, note=n, kind=smp, vel=n.vel, pitch=pitch, idx=n.idx,
                    shape=0.7 + 0.5 * jr.random(), skew=(jr.random() - 0.5) * 0.5, cool=24.0, outline=0.3)
        if smp == 'mallet':
            base.update(kind='petal', L=(0.078 + 0.034 * (pitch + 1) / 2) * jit_L, w=0.014 * jit_w,
                        curl=0.34 * pitch + jit_c, color=GOLD, ecol=GOLD_E, alpha=0.6, grow=0.28, decay=0.5,
                        dir=1, e=1.0)
        elif smp == 'glass':
            base.update(kind='petal', L=(0.105 + 0.05 * (pitch + 1) / 2) * jit_L, w=0.0075 * jit_w,
                        curl=0.22 * pitch + jit_c, color=ICE, ecol=ICE_E, alpha=0.45, grow=0.5, decay=1.5,
                        dir=1, e=0.75, cool=34.0, outline=0.22)
        elif smp in ('hollow-bass', 'sub'):
            base.update(kind='petal', L=(0.052 if smp == 'hollow-bass' else 0.095) * jit_L, w=0.012 * jit_w,
                        curl=0.14 * ((n.note - 43) / 7.0) + jit_c, color=COPPER, ecol=COPPER_E,
                        alpha=0.62, grow=0.16, decay=0.35, dir=-1, e=0.6, cool=18.0, outline=0.26)
        elif smp == 'tom':
            base.update(kind='petal', L=0.07 * jit_L, w=0.024 * jit_w, curl=0.25 * ((n.note % 3) - 1) + jit_c,
                        color=EMBER, ecol=EMBER_E, alpha=0.55, grow=0.2, decay=0.6, dir=1, e=0.9)
        elif smp == 'epiano':
            base.update(kind='petal', L=0.22 * jit_L, w=0.07 * jit_w, curl=0.18 * pitch + jit_c, color=LEAF,
                        ecol=LEAF, alpha=0.11, grow=1.2, decay=1.6, dir=1, e=0.3, cool=40.0, outline=0.22,
                        shape=0.9)
        elif smp == 'warm-pad':
            base.update(kind='petal', L=0.30 * jit_L, w=0.10 * jit_w, curl=-0.15 * pitch + jit_c, color=PAD,
                        ecol=PAD, alpha=0.07, grow=2.0, decay=2.4, dir=1, e=0.22, cool=40.0, outline=0.16,
                        shape=0.9)
        elif smp == 'music-box':
            base.update(kind='star', size=0.02 + 0.01 * (pitch + 1) / 2, decay=1.2)
        elif smp == 'hard-kick':
            base.update(kind='ring', decay=0.32)
        elif smp == 'clap':
            base.update(kind='tick', decay=0.22)
        elif smp == 'riser':
            base.update(kind='riser', dur=1.8)
        elif smp in ('hat', 'open-hat'):
            k = 2 if smp == 'hat' else 5
            r = np.random.default_rng(1000 + (n.idx or 0))
            parts = []
            for _ in range(k):
                parts.append(dict(
                    vr=(0.10 + 0.12 * r.random()) * (1.0 if smp == 'hat' else 1.4),
                    vt=(r.random() - 0.5) * 0.10,
                    life=(1.0 + 1.2 * r.random()) * (1.0 if smp == 'hat' else 1.6),
                    size=1.2 + 1.3 * r.random(),
                    jit=(r.random() - 0.5) * 0.02,
                ))
            base.update(kind='pollen', parts=parts, decay=0.3)
        else:
            return None
        return base

    # ---------------------------------------------------------------- Geometrie
    def petal_geom(self, it, g, S, rot, sway, lift):
        """Blattgeometrie in Pixeln: (Außenpolygon, Kernpolygon, Mittellinie). g: Wachstum 0..1"""
        th = it['th'] + rot
        rh = it['rh']
        d = np.array([math.cos(th), math.sin(th)])
        nrm = np.array([-math.sin(th), math.cos(th)])
        L = it['L'] * g
        w = it['w'] * (0.35 + 0.65 * math.sqrt(g))
        curl = it['curl'] + sway * math.sin(TAU * (self.t_now / 3.1) + rh * 11 + it['th'] * 2) * 0.09
        B = d * rh
        T = B + d * L * it['dir'] + nrm * L * curl
        C = B + d * L * 0.55 * it['dir'] + nrm * L * curl * 0.25
        k = 9
        s = np.linspace(0, 1, k)[:, None]
        P = (1 - s) ** 2 * B + 2 * (1 - s) * s * C + s ** 2 * T
        tang = 2 * (1 - s) * (C - B) + 2 * s * (T - C)
        tl = np.linalg.norm(tang, axis=1, keepdims=True) + 1e-9
        nn = np.stack([-tang[:, 1], tang[:, 0]], axis=1) / tl
        prof = (np.sin(math.pi * s[:, 0]) ** it['shape'])[:, None] * w
        skew = it['skew']
        left = P + nn * prof * (1 + skew)
        right = P - nn * prof * (1 - skew)
        off = self.center + np.array([0, lift])
        poly = np.vstack([left, right[::-1]]) * S + off
        core = np.vstack([P + nn * prof * 0.42, (P - nn * prof * 0.42)[::-1]]) * S + off
        axis = P * S + off
        return poly, core, axis

    # ---------------------------------------------------------------- Bild
    def frame(self, t, i):
        s, cv = self.score, self.canvas
        self.t_now = t
        W, H = self.W, self.H
        tm = min(t, s.music_s)
        S = self.scale(t)
        sec_i, sec = s.section_at(tm)
        sec_name = sec[0]
        # Abschnittsgewichte (weich)
        def sec_w(name, ramp=2.5):
            a, b = self.sec_index[name]
            if t < a - ramp or t > b + ramp:
                return 0.0
            return smooth((t - (a - ramp)) / ramp) * smooth(((b + ramp) - t) / ramp) if (t < a or t > b) else 1.0
        w_zw = sec_w('Zwischenraum')
        w_so = sec_w('Noch einmal Sommer', 4)
        w_off = sec_w('Alles offen', 3)
        w_lauf = sec_w('Laufwerk', 1)
        sway = 0.25 + 0.75 * w_zw
        rot = 0.018 * math.sin(TAU * t / 7.3) * w_zw
        # Auswerfen
        lift = 0.0
        eject = 0.0
        if t > self.t_eject:
            e = (t - self.t_eject) / 1.7
            eject = min(1.0, e)
            lift = -(e ** 2.1) * H * 1.6 if e < 1.0 else -H * 1.6
        # Saftpuls aus Kicks
        kicks = [d for d in self.items_before(t) if d['kind'] == 'ring' and t - d['t'] < 0.6]
        sap = 1.0 + 0.35 * sum(env(t, d['t'], 0.01, 0.18) for d in kicks[-2:])
        warm = 0.35 * w_so + 0.2 * w_off
        afterimage = 0.0
        if eject >= 1.0:
            afterimage = max(0.0, 0.16 * (1 - (t - self.t_eject - 1.7) / 5.5))

        # ---- Hintergrundstimmung
        amb_col = mix(hexc('#1a1410'), hexc('#0e1a22'), w_zw) * (0.35 + 0.25 * w_off + 0.35 * w_so)
        if eject > 0:
            amb_col = amb_col * (1 - eject)
        self.ambient(S * 1.35, amb_col)

        # ---- Rille (die gelesene Spirale)
        self.groove(tm, S, rot, lift, eject)

        # ---- Blätter
        items = self.items_before(t)
        # Abgekühlte Blätter liegen gebacken in einer Scheiben-Rasterschicht; sie wird nur noch transformiert.
        self.bake_until(t)
        self.composite_bake(S, rot, lift, 1.0)
        if afterimage > 0:
            self.composite_bake(S, rot, 0.0, afterimage * 0.9)
        for d in items:
            k = d['kind']
            age = t - d['t']
            if k == 'petal':
                if age >= d['cool']:
                    continue  # bereits gesammelt gezeichnet
                g = ease_out(age / d['grow'], 2.6)
                poly, core, axis = self.petal_geom(d, g, S, rot, sway, lift)
                # Abkühlen: eben noch warmes Licht, dann blasser Geist (Erinnerung)
                f = smooth(min(1.0, age / d['cool']))
                col = mix(d['color'], GHOSTS.get(d['note'].sample, GHOST), f)
                if warm > 0 and d['note'].sample in ('mallet', 'glass'):
                    col = mix(col, hexc('#ffa04a'), warm * 0.3 * (1 - f))
                alpha = d['alpha'] * (1 - 0.55 * f)
                cv.fill_poly(poly, col, alpha)
                if f < 1:
                    cv.fill_poly(core, d['color'], d['alpha'] * 0.55 * (1 - f))
                if d['outline'] > 0:
                    cv.stroke(poly, INK, 1.0, d['outline'] * (0.55 + 0.45 * (1 - f)), closed=True)
                    cv.stroke(axis, INK, 1.0, d['outline'] * 0.5)
                ev = env(t, d['t'], 0.015, d['decay']) * d['vel'] * d['e']
                if ev > 0.004:
                    cv.glow_poly(poly, d['ecol'] * (ev * 1.7 * sap))
                if afterimage > 0:
                    cv.fill_poly(poly - np.array([0, lift]), col, alpha * afterimage * 0.9)
            elif k == 'ring' and age < 0.6:
                p = ease_out(age / 0.42, 1.6)
                r = (0.085 + (d['rh'] + 0.06 - 0.085) * p) * S
                a = (1 - age / 0.6) ** 1.5 * d['vel']
                cv.glow_circle(self.center + [0, lift], r, RING * (0.45 * a), width=max(1.0, 1.4 * self.H / 1080))
            elif k == 'tick' and age < 0.45:
                th = d['th'] + rot
                nrm = np.array([-math.sin(th), math.cos(th)])
                dd = np.array([math.cos(th), math.sin(th)])
                P0 = self.center + (dd * (d['rh'] + 0.012) * S) + [0, lift]
                a = (1 - age / 0.45) ** 2
                ln = 0.03 * S
                cv.glow_line([P0 - nrm * ln, P0 + nrm * ln], CLAP * (1.2 * a), width=2 * self.H / 1080)
                cv.glow_point(P0, CLAP * (1.5 * a), size=4 * self.H / 1080)
            elif k == 'star':
                th = d['th'] + rot
                dd = np.array([math.cos(th), math.sin(th)])
                P0 = self.center + dd * (d['rh'] + 0.02) * S + [0, lift]
                r = d['size'] * S * (0.6 + 0.4 * ease_out(age / 0.3))
                a = env(t, d['t'], 0.02, d['decay'])
                for ang in (0, math.pi / 2):
                    v = np.array([math.cos(ang + th), math.sin(ang + th)]) * r
                    cv.stroke([P0 - v, P0 + v], INK, 1.0, 0.55)
                    if a > 0.01:
                        cv.glow_line([P0 - v, P0 + v], STAR * (1.3 * a), width=1.5)
                if a > 0.01:
                    cv.glow_point(P0, STAR * (2.5 * a), size=5 * self.H / 1080)
            elif k == 'pollen':
                th = d['th'] + rot
                dd = np.array([math.cos(th), math.sin(th)])
                nrm = np.array([-math.sin(th), math.cos(th)])
                for p in d['parts']:
                    if age > p['life']:
                        continue
                    u = age / p['life']
                    rr = d['rh'] + 0.02 + p['vr'] * (1 - (1 - u) ** 2) * p['life'] * 0.55
                    tt = p['vt'] * age + p['jit'] * math.sin(TAU * age * 1.7)
                    P0 = self.center + (dd * rr + nrm * tt) * S + [0, lift]
                    a = (1 - u) ** 1.4 * d['vel'] * 1.3
                    cv.glow_point(P0, POLLEN * a, size=p['size'] * self.H / 1080)
            elif k == 'riser' and age < d['dur']:
                u = age / d['dur']
                th = self.theta(min(t, s.music_s)) + rot
                dd = np.array([math.cos(th), math.sin(th)])
                P0 = self.center + dd * 0.1 * S + [0, lift]
                P1 = self.center + dd * (self.rho(tm) + 0.02) * S + [0, lift]
                cv.glow_line([P0, P1], INK * (0.9 * u ** 2), width=1.5)

        # ---- Lesekopf
        if t < self.t_eject + 0.2:
            self.head(tm, S, rot, lift, 1.0 - eject)
        # ---- Nabe
        self.hub(tm, S, rot, lift, w_lauf, sap, eject)

        # ---- Schrift
        ink = INK
        self.cap.title(cv, 'SMALL MACHINES  ·  PAULA/68', 'Diskettenblumen',
                       f'{s.bpm} BPM  ·  {s.key}  ·  vier Samplekanäle', t, ink, dur=8.0)
        for j, (name, a, b, _, _) in enumerate(s.sections):
            if j == 0:
                continue
            self.cap.section(cv, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][j], name, t - a, ink)
        if t > s.music_s + 1.2:
            self.cap.credits(cv, [('Diskettenblumen', 'title'),
                                  ('Small Machines', 'name'),
                                  ('PAULA/68', 'small'),
                                  ('Allein und zusammen  ·  Berlin, Oktober 2026', 'small')], t - (s.music_s + 1.2), ink, dur=s.tail - 1.6)
        return self.master_fade(t) if t < 1.5 else 1.0 if t < s.duration - 1.5 else max(0.0, (s.duration - t) / 1.5)

    # ---------------------------------------------------------------- Back-Schicht
    def _bake_shape(self, pts, color, alpha, stroke=False, closed=True):
        import cv2
        from engine import SUB, SHIFT
        p = np.asarray(pts, np.float64)
        x0 = max(int(math.floor(p[:, 0].min())) - 3, 0); y0 = max(int(math.floor(p[:, 1].min())) - 3, 0)
        x1 = min(int(math.ceil(p[:, 0].max())) + 4, self.bake_size); y1 = min(int(math.ceil(p[:, 1].max())) + 4, self.bake_size)
        if x1 <= x0 or y1 <= y0:
            return
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        ip = np.round((p - [x0, y0]) * SUB).astype(np.int32).reshape(-1, 1, 2)
        if stroke:
            cv2.polylines(mask, [ip], closed, 1.0, 1, cv2.LINE_AA, shift=SHIFT)
        else:
            cv2.fillPoly(mask, [ip], 1.0, cv2.LINE_AA, shift=SHIFT)
        a = (mask * alpha)[..., None]
        sub = self.bake[y0:y1, x0:x1]
        sub[..., :3] *= (1 - a)
        sub[..., :3] += a * np.asarray(color, np.float32)
        sub[..., 3:4] *= (1 - a)
        sub[..., 3:4] += a

    def bake_until(self, t):
        while self.cool_ptr < len(self.cool_list) and self.cool_list[self.cool_ptr]['t'] + self.cool_list[self.cool_ptr]['cool'] <= t:
            d = self.cool_list[self.cool_ptr]
            self.cool_ptr += 1
            save_center, self.center = self.center, self.bake_center
            self.t_now = 0.0
            poly, core, axis = self.petal_geom(d, 1.0, self.Sb, 0.0, 0.0, 0.0)
            self.center = save_center
            smp = d['note'].sample
            self._bake_shape(poly, GHOSTS.get(smp, GHOST), d['alpha'] * 0.45)
            if d['outline'] > 0:
                self._bake_shape(poly, INK, d['outline'] * 0.55, stroke=True, closed=True)
                self._bake_shape(axis, INK, d['outline'] * 0.5, stroke=True, closed=False)

    def composite_bake(self, S, rot, lift, gain):
        import cv2
        if self.cool_ptr == 0:
            return
        k = S / self.Sb
        c, sn = math.cos(rot) * k, math.sin(rot) * k
        cx, cy = self.bake_center
        tx = self.center[0] - (c * cx - sn * cy)
        ty = self.center[1] + lift - (sn * cx + c * cy)
        M = np.array([[c, -sn, tx], [sn, c, ty]], np.float64)
        warped = cv2.warpAffine(self.bake, M, (self.W, self.H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        a = warped[..., 3:4] * gain
        self.canvas.base *= (1 - a)
        self.canvas.base += warped[..., :3] * gain

    def warmup(self, t, fps):
        self.bake_until(t)

    # ---------------------------------------------------------------- Teile
    def items_before(self, t):
        k = int(np.searchsorted(self.item_starts, t, side='right'))
        return self.items[:k]

    def ambient(self, radius, col):
        if not hasattr(self, '_amb'):
            s = 4
            ys, xs = np.mgrid[0:self.H // s, 0:self.W // s].astype(np.float32)
            self._amb_d = np.sqrt((xs * s - self.center[0]) ** 2 + (ys * s - self.center[1]) ** 2)
            self._amb = True
        import cv2
        key = int(radius / 12)
        if getattr(self, '_amb_key', None) != key:
            g = np.clip(1 - self._amb_d / (key * 12 + 6), 0, 1) ** 2.2
            self._amb_up = cv2.resize(g, (self.W, self.H), interpolation=cv2.INTER_LINEAR)[..., None]
            self._amb_key = key
        self.canvas.emit += self._amb_up * np.asarray(col, np.float32)

    def groove(self, tm, S, rot, lift, eject):
        n = int(max(8, tm / self.turn_s * 180))
        ts = np.linspace(0, tm, n)
        th = -math.pi / 2 + TAU * ts / self.turn_s + rot
        rh = self.rho0 + (1 - self.rho0) * ts / self.score.music_s
        pts = self.center + np.stack([np.cos(th) * rh, np.sin(th) * rh], axis=1) * S + [0, lift]
        self.canvas.stroke(pts, INK_DIM, 1.0, 0.16 * (1 - eject))

    def head(self, tm, S, rot, lift, a):
        th = self.theta(tm) + rot
        dd = np.array([math.cos(th), math.sin(th)])
        c = self.center + [0, lift]
        P0 = c + dd * 0.095 * S
        P1 = c + dd * (self.rho(tm) + 0.045) * S
        self.canvas.stroke([P0, P1], INK, 1.0, 0.42 * a)
        self.canvas.glow_line([P0, P1], INK * (0.12 * a), width=1.2)
        # Nachleuchten des Sektors
        for k in range(1, 10):
            thk = th - k * 0.022
            dk = np.array([math.cos(thk), math.sin(thk)])
            self.canvas.glow_line([c + dk * 0.1 * S, c + dk * (self.rho(tm) + 0.03) * S],
                                  INK * (0.05 * (1 - k / 10) * a), width=1.0)
        # Spitze des Kopfs
        self.canvas.glow_point(P1, POLLEN * (0.9 * a), size=3.5 * self.H / 1080)

    def hub(self, tm, S, rot, lift, w_lauf, sap, eject):
        cv = self.canvas
        c = self.center + [0, lift]
        th = self.theta(tm) + rot
        R = 0.09 * S
        cv.circle(c, R, HUB, 1.0)
        cv.circle(c, R, INK, 0.75, width=max(1.5, 2.0 * self.H / 1080))
        cv.circle(c, R * 0.97, HUB_HI, 0.6, width=max(1.0, 1.5 * self.H / 1080))
        # Spindelloch (quadratisch, dreht mit)
        a = 0.028 * S
        sq = []
        for k in range(4):
            ang = th + k * math.pi / 2 + math.pi / 4
            sq.append(c + np.array([math.cos(ang), math.sin(ang)]) * a * math.sqrt(2))
        cv.fill_poly(sq, hexc(self.BG), 1.0)
        cv.stroke(sq, INK, 1.2, 0.7, closed=True)
        # Indexschlitz
        dd = np.array([math.cos(th + math.pi / 2), math.sin(th + math.pi / 2)])
        nn = np.array([math.cos(th), math.sin(th)])
        m = c + dd * 0.052 * S
        hw, hh = 0.008 * S, 0.017 * S
        slot = [m + nn * hw + dd * hh, m - nn * hw + dd * hh, m - nn * hw - dd * hh, m + nn * hw - dd * hh]
        cv.fill_poly(slot, hexc(self.BG), 1.0)
        cv.stroke(slot, INK, 1.2, 0.7, closed=True)
        # Leuchten der Nabe: Laufwerk hell, sonst leise; Saftpuls
        glow = (0.10 + 0.22 * w_lauf) * (0.6 + 0.4 * (sap - 1) / 0.35 if sap > 1 else 0.6)
        cv.glow_circle(c, R, COPPER_E * (glow * (1 - eject) * 0.9), width=max(1.5, 2.0 * self.H / 1080))
        # Laufwerks-LED (kleiner grüner Punkt, blinkt im Takt beim Einlesen; aus nach dem Auswerfen)
        led_on = (tm % self.score.bar_s) < self.score.bar_s * 0.5 if w_lauf > 0.5 else True
        if eject < 1 and led_on:
            P = np.array([self.W * 0.948, self.H * 0.905])
            cv.glow_point(P, hexc('#6fff8a') * (0.35 * (1 - eject)), size=1.6 * self.H / 1080)
            cv.circle(P, 1.4 * self.H / 1080, hexc('#6fff8a'), 0.7)
