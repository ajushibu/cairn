"""Sound for the character version (4 shots). Usage: python -I sound2.py <outdir> -> mix2_raw.wav"""
import sys, wave, math
import numpy as np

out = sys.argv[1]
SR = 44100
DUR = 5.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N)

# ---- timing shared with the scene ----
E8 = 60 / 112 / 2
BEAT = 2 * E8
CUTS = [5 * E8, 9 * E8, 14 * E8]
EVENTS = [4 * E8, 7 * E8, 12 * E8, 16 * E8]
PAYOFF = EVENTS[3]
FLIGHT = 0.28
def vis(t):  # when an event at anim-time t first appears on screen (24 fps anim, 30 fps out)
    af = math.ceil(t * 24 - 1e-9)
    return math.ceil(af * 30 / 24) / 30

def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    sig = sig[:N - i0] * gain
    a = (pan + 1) * math.pi / 4
    L[i0:i0 + len(sig)] += sig * math.cos(a)
    R[i0:i0 + len(sig)] += sig * math.sin(a)

def tt(d): return np.arange(int(d * SR)) / SR
def env(d, a=0.005, decay=0.3):
    x = tt(d); return np.minimum(1, x / a) * np.exp(-x / decay)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def onepole(x, fc):
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    y = np.zeros_like(x); s = 0.0
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y
def bandnoise(d, lo, hi):
    n = rng.normal(0, 1, int(d * SR))
    return onepole(n, hi) - onepole(n, lo)

# ================= MUSIC =================
def ep(m, d, vel=1.0):  # warm electric piano
    x = tt(d); f = mtof(m)
    s = np.sin(2 * np.pi * f * x) + 0.28 * np.sin(4 * np.pi * f * x) * np.exp(-x / 0.3) + 0.08 * np.sin(6 * np.pi * f * x) * np.exp(-x / 0.15)
    s *= (1 + 0.12 * np.sin(2 * np.pi * 5.2 * x))
    return s * np.minimum(1, x / 0.01) * np.exp(-x / 1.6) * vel
def ks(m, d, damp=0.996):  # Karplus-Strong pluck bass
    f = mtof(m); p = int(SR / f)
    buf = rng.uniform(-1, 1, p); buf = onepole(buf, 900)
    n = int(d * SR); o = np.zeros(n)
    for i in range(n):
        o[i] = buf[i % p]
        buf[i % p] = damp * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return o * np.exp(-tt(d) / 0.9)
def marimba(m, d=0.6):
    x = tt(d); f = mtof(m)
    s = np.sin(2 * np.pi * f * x) * np.exp(-x / 0.35) + 0.25 * np.sin(2 * np.pi * 3.93 * f * x) * np.exp(-x / 0.05)
    return s * np.minimum(1, x / 0.002)

chords = [(0.0, [50, 53, 57, 60, 64]), (4 * BEAT, [58, 62, 65, 69]), (6 * BEAT, [60, 64, 67, 70]), (PAYOFF, [53, 57, 60, 64, 67, 72])]
for k, (t0, notes) in enumerate(chords):
    d = (chords[k + 1][0] - t0 + 0.4) if k + 1 < len(chords) else DUR - t0
    for j, m in enumerate(notes):
        add(ep(m, d, 0.9 if k < 3 else 1.15), t0 + 0.012 * j, 0.06, -0.25 + 0.12 * j)
    # gentle re-strike on half bars
    if k < 3:
        for j, m in enumerate(notes[1:]):
            add(ep(m, 0.9, 0.5), t0 + 2 * BEAT, 0.035, 0.2 - 0.1 * j)
bass = [(0.0, 38), (2 * BEAT, 45), (4 * BEAT, 34), (6 * BEAT, 36), (PAYOFF, 41)]
for t0, m in bass:
    add(ks(m, 1.3 if t0 < PAYOFF else 0.7), t0, 0.32)

# marimba: one note per visible tally mark (counts 1, 4, 8, 10), then a flourish
for m, ev in zip([55, 62, 72, 77], EVENTS):
    add(marimba(m, 0.9 if ev == PAYOFF else 0.5), vis(ev), 0.17 if ev != PAYOFF else 0.24, 0.3)
add(marimba(65, 1.2), vis(PAYOFF), 0.14, 0.1)
for k, m in enumerate([81, 84, 89]):
    add(marimba(m, 0.7), vis(PAYOFF) + 0.12 + 0.07 * k, 0.11, 0.4 - 0.1 * k)
# drums until the payoff
def kick(g=1.0):
    x = tt(0.35); f = 45 + 80 * np.exp(-x / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.12) * g
def brush(): return bandnoise(0.25, 1200, 6000) * env(0.25, 0.01, 0.08)
def shaker(): return bandnoise(0.06, 4000, 8000) * env(0.06, 0.004, 0.02)
b = 0
while b * BEAT < PAYOFF - 0.01:
    add(kick() if b % 2 == 0 else brush(), b * BEAT, 0.45 if b % 2 == 0 else 0.10, 0.1 * (b % 2))
    b += 1
for e in range(int(PAYOFF / E8)):
    add(shaker(), e * E8, 0.02 if e % 2 else 0.012, 0.35)
add(kick(1.3), vis(PAYOFF), 0.55)

# ================= SFX =================
def whoosh(d, lo, hi, peak=0.6):
    x = tt(d); w = onepole(rng.normal(0, 1, len(x)), lo + (hi - lo) * np.sin(np.pi * np.clip(x / d, 0, 1)) ** 2)
    return w * np.sin(np.pi * np.clip(x / d, 0, 1)) ** 1.5
for c in CUTS:  # soft air on each cut
    add(whoosh(0.3, 200, 1800), vis(c) - 0.2, 0.22, -0.2)
add(whoosh(0.55, 250, 2400), vis(PAYOFF) - 0.06, 0.35, -0.5)  # payoff pan
# machine: stitch clicks each beat + flywheel whirr
for k in range(40):
    t0 = (0.25 + k) * BEAT
    if t0 > PAYOFF + 0.05: break
    click = bandnoise(0.03, 1800, 4500) * env(0.03, 0.001, 0.006) + 0.5 * np.sin(2 * np.pi * 1250 * tt(0.03)) * env(0.03, 0.001, 0.01)
    thunk = np.sin(2 * np.pi * 160 * tt(0.08)) * env(0.08, 0.002, 0.025)
    add(click, vis(t0), 0.2, 0.1); add(thunk, vis(t0), 0.24, 0.1); add(click * 0.5, vis(t0 + BEAT / 2), 0.1, 0.1)
x = np.arange(N) / SR
spd = np.where(x < PAYOFF, 1.0, np.exp(-3.2 * (x - PAYOFF)))
add(bandnoise(DUR, 180, 650) * (0.6 + 0.4 * np.sin(2 * np.pi * (112 / 60) * x)) * spd, 0, 0.05, 0.1)
# chalk scratch on each tally mark
for ev in EVENTS:
    d = 0.11; xx = tt(d)
    add(bandnoise(d, 1800, 5000) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 70 * xx))) * np.sin(np.pi * xx / d), vis(ev) + 0.01, 0.2, 0.3)
# boxes: off-screen thuds in shots 1-2, full swoosh + thud for 8 and 10
for k, ev in enumerate(EVENTS):
    big = ev == PAYOFF
    if k >= 2:
        d = FLIGHT + 0.05; xx = tt(d)
        add(onepole(rng.normal(0, 1, len(xx)), 600 + 3000 * xx / d) * np.sin(np.pi * xx / d), vis(ev - FLIGHT), 0.11, 0.5)
    d = 0.45 if big else 0.2; xx = tt(d)
    f = (100 + 5 * k) * (1 + 0.6 * np.exp(-xx / 0.02))
    thud = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-xx / (0.12 if big else 0.05))
    g = 1.0 if k >= 2 else 0.4
    add(thud, vis(ev), (0.55 if big else 0.4) * g, 0.5)
    add(bandnoise(d, 250, 1400) * np.exp(-xx / 0.03), vis(ev), (0.45 if big else 0.3) * g, 0.5)
# shot 3: head jerks up when the box lands -> little wood-block "tok"
add(np.sin(2 * np.pi * 820 * tt(0.06)) * env(0.06, 0.001, 0.012), vis(EVENTS[2]) + 0.05, 0.16, -0.2)
# payoff: ding, cloth rustle
xx = tt(2.0); f0 = mtof(84)
ding = sum(a * np.sin(2 * np.pi * f0 * r * xx) * np.exp(-xx / dcy) for r, a, dcy in [(1, 1, 0.9), (2.76, 0.35, 0.3), (5.4, 0.15, 0.12), (8.93, 0.06, 0.06)])
add(ding * np.minimum(1, xx / 0.002), vis(PAYOFF) + 0.04, 0.10, 0.05)
xx = tt(0.45)
add(bandnoise(0.45, 400, 3000) * np.sin(np.pi * xx / 0.45) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * xx)), vis(PAYOFF) + 0.03, 0.14, -0.3)

# ================= AMBIENCE =================
add(onepole(rng.normal(0, 1, N), 500), 0, 0.05, 0.0)
for t0 in [0.2, 0.36, 0.8, 0.95]:  # dawn birds (shot 1)
    xx = tt(0.09); f = 3600 + 1400 * np.sin(np.pi * xx / 0.09)
    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * xx / 0.09), t0, 0.03, -0.6)
for k in range(int((DUR - CUTS[0]) / 0.17)):  # night crickets (shots 2-4)
    xx = tt(0.07)
    add(np.sin(2 * np.pi * 4700 * xx) * (np.sin(2 * np.pi * 45 * xx) > 0) * np.sin(np.pi * xx / 0.07), vis(CUTS[0]) + k * 0.17, 0.011, -0.6)
xx = np.arange(int((DUR - CUTS[0]) * SR)) / SR  # lamp filament hum at night
add(np.sin(2 * np.pi * 120 * xx) + 0.3 * np.sin(2 * np.pi * 240 * xx), vis(CUTS[0]), 0.008, 0.2)

# ================= WRITE =================
mix = np.stack([L, R], 1)
mix /= np.abs(mix).max() + 1e-9
mix *= 0.7
with wave.open(f"{out}/mix2_raw.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok", [round(vis(e), 3) for e in EVENTS])
