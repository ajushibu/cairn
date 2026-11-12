"""Sound for the 7 s problem-of-evil clip (no samples).
Usage: python -I sound3.py <outdir>  -> mix3_raw.wav"""
import sys, wave, math
import numpy as np

out = sys.argv[1]
SR = 44100; DUR = 7.0; N = int(SR * DUR)
rng = np.random.default_rng(23)
L = np.zeros(N); R = np.zeros(N)
CUTS = [1.4, 2.55, 4.1, 5.0]
T_STAB, T_HIT, T_OUT = 5.5, 5.62, 6.15

def vis(t):  # first 30 fps frame showing 24 fps anim-time t
    af = math.ceil(t * 24 - 1e-9)
    return math.ceil(af * 30 / 24) / 30
def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    sig = sig[:N - i0] * gain
    a = (pan + 1) * math.pi / 4
    L[i0:i0 + len(sig)] += sig * math.cos(a); R[i0:i0 + len(sig)] += sig * math.sin(a)
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
    n = rng.normal(0, 1, int(d * SR)); return onepole(n, hi) - onepole(n, lo)
def saw(f, d):
    x = tt(d); return 2 * ((x * f) % 1) - 1
def fade(sig, a, r):
    n = len(sig); e = np.ones(n)
    ia, ir = int(a * SR), int(r * SR)
    if ia: e[:ia] = np.linspace(0, 1, ia)
    if ir: e[-ir:] = np.minimum(e[-ir:], np.linspace(1, 0, ir))
    return sig * e

# ---- dread: drone + tremolo strings (shots 1-2, return in 4-5) ----
def drone(d):
    x = tt(d)
    s = sum(onepole(saw(mtof(m) * (1 + 0.002 * k), d), 400) for k, m in enumerate([38, 45, 50]))
    return s * (0.7 + 0.3 * np.sin(2 * np.pi * 0.4 * x))
add(fade(drone(CUTS[1]), 0.3, 0.05), 0, 0.22)
add(fade(drone(DUR - CUTS[2]), 0.0, 0.1), vis(CUTS[2]), 0.24)
def trem(notes, d):
    x = tt(d)
    s = sum(onepole(saw(mtof(m), d), 1800) for m in notes)
    return s * (0.55 + 0.45 * np.sin(2 * np.pi * 9 * x)) * np.minimum(1, x / 1.2)
add(fade(trem([62, 65, 69], CUTS[1]), 0.0, 0.05), 0, 0.06, 0.2)
add(fade(trem([62, 63, 68], T_OUT - CUTS[2]), 0.0, 0.05), vis(CUTS[2]), 0.07, -0.2)

# heartbeat, accelerating 72 -> 120 BPM through shots 1-2
t0 = 0.15
while t0 < CUTS[1] - 0.1:
    bpm = 72 + 48 * (t0 / CUTS[1])
    for dt, g in [(0, 1.0), (0.16, 0.6)]:
        x = tt(0.25); f = 42 + 30 * np.exp(-x / 0.02)
        add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.07), t0 + dt, 0.5 * g)
    t0 += 60 / bpm

# knife: metallic "shing" as the close-up starts, ring with the gleam
def shing(d=1.2, f0=2100):
    x = tt(d)
    ring = sum(a * np.sin(2 * np.pi * f0 * r * x) * np.exp(-x / dc) for r, a, dc in [(1, 1, 0.5), (1.62, 0.6, 0.35), (2.47, 0.4, 0.2), (3.9, 0.2, 0.1)])
    scrape = bandnoise(d, 2500, 9000) * np.exp(-x / 0.12)
    return (ring * 0.6 + scrape) * np.minimum(1, x / 0.003)
add(shing(), vis(CUTS[0]), 0.10, 0.3)
add(shing(1.0, 2600), vis(CUTS[0] + 0.25), 0.07, 0.1)

# ---- shot 3: the imagined mercy: warm choir pad + rubbery boing ----
d = CUTS[2] - CUTS[1]; x = tt(d)
pad = sum(np.sin(2 * np.pi * mtof(m) * x + 0.3 * np.sin(2 * np.pi * 5 * x)) for m in [53, 57, 60, 65, 69, 72])
add(fade(pad * np.minimum(1, x / 0.25), 0.0, 0.08), vis(CUTS[1]), 0.05)
for k, m in enumerate([84, 88, 91, 96]):  # shimmer bells
    xx = tt(1.0); add(np.sin(2 * np.pi * mtof(m) * xx) * np.exp(-xx / 0.4), vis(CUTS[1]) + 0.05 + 0.09 * k, 0.04, -0.3 + 0.2 * k)
xx = tt(1.2)
f = 150 * (1 + 0.35 * np.sin(2 * np.pi * 7.5 * xx) * np.exp(-xx / 0.4)) * (1 + 0.5 * np.exp(-xx / 0.05))
boing = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-xx / 0.5) * np.minimum(1, xx / 0.01)
add(boing, vis(CUTS[1] + 0.25), 0.32, 0.1)

# ---- shot 4: reality snaps back ----
xx = tt(1.4)
boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-xx / 0.05)) / SR) * np.exp(-xx / 0.5)
add(boom, vis(CUTS[2]), 0.7)
add(bandnoise(0.5, 200, 4000) * np.exp(-tt(0.5) / 0.08), vis(CUTS[2]), 0.35)
clus = sum(onepole(saw(mtof(m), 0.9), 2500) for m in [50, 51, 56, 62]) * np.exp(-tt(0.9) / 0.35)
add(clus, vis(CUTS[2]), 0.09)
add(shing(1.0, 3100), vis(CUTS[2] + 0.12), 0.11, 0.4)

# ---- shot 5: the act (heard, not seen), the lamp, the dark ----
xx = tt(0.25)
sw = onepole(rng.normal(0, 1, len(xx)), 500 + 4000 * np.sin(np.pi * xx / 0.25) ** 2) * np.sin(np.pi * xx / 0.25)
add(sw, vis(T_STAB) - 0.08, 0.45, 0.2)
xx = tt(0.4)
add(np.sin(2 * np.pi * np.cumsum(60 + 50 * np.exp(-xx / 0.03)) / SR) * np.exp(-xx / 0.09), vis(T_HIT), 0.75)
add(bandnoise(0.4, 100, 900) * np.exp(-xx / 0.05), vis(T_HIT), 0.4)
for k, dt in enumerate([0.05, 0.12, 0.2, 0.31, 0.38]):  # lamp clatter
    xx = tt(0.12)
    add(bandnoise(0.12, 1500, 8000) * np.exp(-xx / 0.02) + 0.4 * np.sin(2 * np.pi * (900 + 400 * k) * xx) * np.exp(-xx / 0.04), vis(T_HIT) + dt, 0.25 / (1 + 0.4 * k), -0.3 + 0.15 * k)
d = T_OUT - T_HIT; xx = tt(d)
buzz = (np.sin(2 * np.pi * 120 * xx) + 0.5 * np.sign(np.sin(2 * np.pi * 120 * xx))) * (np.sin(2 * np.pi * 11 * xx) > -0.2)
add(buzz, vis(T_HIT), 0.04)
add(bandnoise(0.03, 1500, 8000) * env(0.03, 0.0005, 0.004), vis(T_OUT), 0.6)
# silence after: thin cold wind
d = DUR - T_OUT; xx = tt(d)
add(bandnoise(d, 300, 1200) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.7 * xx)) * np.minimum(1, xx / 0.6), vis(T_OUT), 0.05, -0.4)
add(onepole(rng.normal(0, 1, N), 400), 0, 0.03)

mix = np.stack([L, R], 1)
mix /= np.abs(mix).max() + 1e-9
mix *= 0.7
with wave.open(f"{out}/mix3_raw.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok")
