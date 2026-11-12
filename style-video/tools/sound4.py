"""Sound for the 7 s gods-and-karma clip (no samples).
Usage: python -I sound4.py <outdir>  -> mix4_raw.wav"""
import sys, wave, math
import numpy as np

out = sys.argv[1]
SR = 44100; DUR = 7.0; N = int(SR * DUR)
rng = np.random.default_rng(23)
L = np.zeros(N); R = np.zeros(N)
CUTS = [1.4, 3.4, 4.5]
T_CLASH = 2.3

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


def bell(m, d=1.6):
    x = tt(d); f = mtof(m)
    return sum(a * np.sin(2 * np.pi * f * r * x) * np.exp(-x / dc) for r, a, dc in [(1, 1, 0.8), (2.76, 0.3, 0.3), (5.4, 0.12, 0.12)]) * np.minimum(1, x / 0.003)
def boom(g=1.0, d=1.2):
    x = tt(d); return np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-x / 0.05)) / SR) * np.exp(-x / 0.45) * g

# ---- shot 1: calm night, a shrug ----
d = CUTS[0]; x = tt(d)
pad = sum(np.sin(2 * np.pi * mtof(m) * x) for m in [50, 57, 62, 64, 69])
add(fade(pad, 0.3, 0.1), 0, 0.045)
for k in range(int(CUTS[0] / 0.17)):
    xx = tt(0.07)
    add(np.sin(2 * np.pi * 4700 * xx) * (np.sin(2 * np.pi * 45 * xx) > 0) * np.sin(np.pi * xx / 0.07), k * 0.17, 0.012, -0.5)
for k, m in enumerate([69, 62]):  # two-note "who knows"
    xx = tt(0.6); add(np.sin(2 * np.pi * mtof(m) * xx) * np.exp(-xx / 0.25), 0.45 + 0.28 * k, 0.14, 0.2)

# ---- shot 2: the gods at war ----
d = CUTS[1] - CUTS[0]; x = tt(d)
rumble = onepole(rng.normal(0, 1, len(x)), 120) * (0.4 + 0.6 * x / d)
add(fade(rumble, 0.05, 0.1), vis(CUTS[0]), 0.9)
t0 = CUTS[0] + 0.05; gap = 0.26
while t0 < T_CLASH - 0.05:  # war drums, accelerating
    add(boom(0.6, 0.4), t0, 0.5); t0 += gap; gap *= 0.86
add(fade(sum(onepole(saw(mtof(m), d), 900) for m in [38, 39, 45]), 0.1, 0.1), vis(CUTS[0]), 0.07)
add(boom(1.3, 1.5), vis(T_CLASH), 0.9)
xx = tt(0.9)
add(bandnoise(0.9, 800, 9000) * np.exp(-xx / 0.12) + bandnoise(0.9, 200, 2000) * np.exp(-xx / 0.35), vis(T_CLASH) + 0.02, 0.6)
d = CUTS[1] - T_CLASH - 0.2; xx = tt(d)  # fire crackle
crk = bandnoise(d, 1500, 7000) * (rng.random(len(xx)) > 0.9995).astype(float)
add(onepole(np.convolve(crk, np.exp(-np.arange(400) / 60), 'same'), 6000), vis(T_CLASH) + 0.2, 0.5, 0.3)

# ---- shot 3: an angered god points ----
add(boom(1.2, 1.3), vis(CUTS[1]), 0.8)
add(sum(onepole(saw(mtof(m), 1.1), 1500) for m in [38, 44, 50, 51]) * np.exp(-tt(1.1) / 0.5), vis(CUTS[1]), 0.1)
xx = tt(0.3)
add(onepole(rng.normal(0, 1, len(xx)), 400 + 3000 * xx / 0.3) * np.sin(np.pi * xx / 0.3), vis(CUTS[1]), 0.3, 0.4)

# ---- shot 4: the wheel of karma ----
d = DUR - CUTS[2]; x = tt(d)
tan = sum(onepole(saw(mtof(m) * (1 + 0.0015 * k), d), 1100) * (0.6 + 0.4 * np.sin(2 * np.pi * (0.9 + 0.3 * k) * x + k)) for k, m in enumerate([38, 45, 50, 50]))
add(fade(tan, 0.15, 0.5), vis(CUTS[2]), 0.1)
add(fade(sum(np.sin(2 * np.pi * mtof(m) * x) for m in [62, 66, 69]), 0.4, 0.6), vis(CUTS[2]), 0.035)
for k, m in enumerate([62, 66, 69, 74]):  # the ember reaches each life
    add(bell(m), vis(CUTS[2] + (20 + 90 * k) / 124), 0.16, -0.3 + 0.2 * k)
add(fade(onepole(rng.normal(0, 1, len(x)), 200) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.6 * x)), 0.2, 0.4), vis(CUTS[2]), 0.25)  # wheel rumble
add(onepole(rng.normal(0, 1, N), 400), 0, 0.03)

mix = np.stack([L, R], 1)
mix /= np.abs(mix).max() + 1e-9
mix *= 0.7
with wave.open(f"{out}/mix4_raw.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok")
