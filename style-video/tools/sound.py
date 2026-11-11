"""Synthesise music + SFX + ambience for the 5 s workshop clip (no samples).
Usage: python -I sound.py <outdir>   -> writes mix_raw.wav (stereo 44.1k float)"""
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
LAND = [k * E8 for k in [2, 4, 6, 8, 10, 12, 13, 14, 15, 16]]
FLIGHT = 0.25
PAYOFF = LAND[9]
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
# ascending marimba count: one note per box landing, 10th lands on F5 over Fmaj9
scale = [55, 57, 60, 62, 65, 67, 69, 72, 74, 77]
for k, l in enumerate(LAND):
    add(marimba(scale[k], 0.9 if k == 9 else 0.5), vis(l), 0.16 if k < 9 else 0.24, 0.3)
    if k == 9: add(marimba(scale[k] - 12, 1.2), vis(l), 0.14, 0.1)
# drums: soft kick, brush snare, shaker eighths (stop at payoff)
def kick(g=1.0):
    x = tt(0.35); f = 45 + 80 * np.exp(-x / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.12) * g
def brush():
    return bandnoise(0.25, 1200, 6000) * env(0.25, 0.01, 0.08)
def shaker():
    return bandnoise(0.06, 4000, 9000) * env(0.06, 0.004, 0.02)
for b in range(int(PAYOFF / BEAT) + 1):
    t0 = b * BEAT
    if t0 >= PAYOFF - 0.01: break
    if b % 2 == 0: add(kick(), t0, 0.45)
    else: add(brush(), t0, 0.10, 0.1)
for e in range(int(PAYOFF / E8)):
    add(shaker(), e * E8, 0.03 if e % 2 else 0.018, 0.35)
add(kick(1.3), vis(PAYOFF), 0.55)

# ================= SFX =================
# camera whoosh with the foreground wipe (0-1.05 s)
d = 1.25; x = tt(d)
w = rng.normal(0, 1, len(x)); w = onepole(w, 300 + 2200 * np.sin(np.pi * np.clip(x / 1.1, 0, 1)) ** 2)
add(w * np.sin(np.pi * np.clip(x / d, 0, 1)) ** 1.5, 0.0, 0.5, -0.5)
# machine stitch clicks (needle bottom) + flywheel whirr
for k in range(40):
    t0 = (0.25 + k) * BEAT
    if t0 > PAYOFF + 0.05: break
    click = bandnoise(0.03, 1800, 4500) * env(0.03, 0.001, 0.006) + 0.5 * np.sin(2 * np.pi * 1250 * tt(0.03)) * env(0.03, 0.001, 0.01)
    thunk = np.sin(2 * np.pi * 160 * tt(0.08)) * env(0.08, 0.002, 0.025)
    add(click, vis(t0), 0.22, -0.15)
    add(thunk, vis(t0), 0.25, -0.15)
    add(click * 0.5, vis(t0 + BEAT / 2), 0.12, -0.1)
x = np.arange(N) / SR
spd = np.where(x < PAYOFF, 1.0, np.exp(-3.2 * (x - PAYOFF)))
whirr = bandnoise(DUR, 180, 650) * (0.6 + 0.4 * np.sin(2 * np.pi * (112 / 60) * x)) * spd
add(whirr, 0, 0.05, -0.1)
# clock ticks: fast time-lapse sixteenths until payoff
for k in range(int(PAYOFF / (E8 / 2))):
    tick = np.sin(2 * np.pi * 1900 * tt(0.02)) * env(0.02, 0.0005, 0.004)
    add(tick, k * E8 / 2, 0.05 if k % 2 else 0.08, 0.55)
# boxes: launch swoosh + cardboard thud (pitch rises with stack), chalk scratch
for k, l in enumerate(LAND):
    d = FLIGHT + 0.05; xx = tt(d)
    sw = onepole(rng.normal(0, 1, len(xx)), 600 + 3000 * xx / d) * np.sin(np.pi * xx / d)
    add(sw, vis(l - FLIGHT), 0.10, 0.0 + 0.35 * k / 9)
    big = k == 9
    d = 0.45 if big else 0.2; xx = tt(d)
    f = (90 + 6 * k) * (1 + 0.6 * np.exp(-xx / 0.02))
    thud = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-xx / (0.12 if big else 0.05))
    tock = bandnoise(d, 250, 1400) * np.exp(-xx / 0.03)
    add(thud, vis(l), 0.55 if big else 0.4, 0.35)
    add(tock, vis(l), 0.45 if big else 0.3, 0.35)
    d = 0.11; xx = tt(d)
    sc = bandnoise(d, 1800, 5500) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 70 * xx))) * np.sin(np.pi * xx / d)
    add(sc, vis(l) + 0.02, 0.22, 0.25)
# payoff: lamp click / flicker / ding, cloth rustle, filament hum
def clk(): return bandnoise(0.02, 1500, 8000) * env(0.02, 0.0005, 0.003)
for dt, g in [(0.10, 0.5), (0.14, 0.25), (0.20, 0.5)]:
    add(clk(), vis(PAYOFF + dt), g, 0.0)
xx = tt(DUR - PAYOFF)
hum = (np.sin(2 * np.pi * 120 * xx) + 0.3 * np.sin(2 * np.pi * 240 * xx)) * np.minimum(1, xx / 0.05)
add(hum, vis(PAYOFF + 0.2), 0.012, 0.0)
xx = tt(2.0); f0 = mtof(84)
ding = sum(a * np.sin(2 * np.pi * f0 * r * xx) * np.exp(-xx / dcy) for r, a, dcy in [(1, 1, 0.9), (2.76, 0.35, 0.3), (5.4, 0.15, 0.12), (8.93, 0.06, 0.06)])
add(ding * np.minimum(1, xx / 0.002), vis(PAYOFF + 0.2), 0.11, 0.05)
xx = tt(0.45)
rus = bandnoise(0.45, 400, 3000) * np.sin(np.pi * xx / 0.45) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * xx))
add(rus, vis(PAYOFF + 0.02), 0.12, -0.3)

# ================= AMBIENCE =================
room = onepole(rng.normal(0, 1, N), 500)
add(room, 0, 0.05, 0.0)
for t0 in [0.35, 0.52, 1.25, 1.4]:
    xx = tt(0.09); f = 3600 + 1400 * np.sin(np.pi * xx / 0.09)
    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * xx / 0.09), t0, 0.03, -0.6)
for k in range(10):  # crickets as dusk falls
    t0 = 3.4 + k * 0.17
    xx = tt(0.07)
    add(np.sin(2 * np.pi * 4700 * xx) * (np.sin(2 * np.pi * 45 * xx) > 0) * np.sin(np.pi * xx / 0.07), t0, 0.012 * min(1, k / 3), -0.6)

# ================= WRITE =================
mix = np.stack([L, R], 1)
mix /= np.abs(mix).max() + 1e-9
mix *= 0.7
with wave.open(f"{out}/mix_raw.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok", round(PAYOFF, 3), round(vis(PAYOFF), 3))
