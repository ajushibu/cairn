"""Frame-by-frame analysis of a video at native fps.
Usage: python -I analyse.py <video> <outdir>
Writes metrics.json with cuts, shot lengths, motion/cadence, camera, grade, palette."""
import sys, json, subprocess
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
W, H = 320, 180
cmd = ["ffmpeg", "-loglevel", "error", "-i", src, "-vf", f"scale={W}:{H}:flags=area",
       "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
raw = subprocess.run(cmd, capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
n = len(F)
Y = (F[..., 0] * .299 + F[..., 1] * .587 + F[..., 2] * .114).astype(np.float32)

# --- frame difference & cuts
d = np.abs(np.diff(Y, axis=0)).mean(axis=(1, 2))
med = np.array([np.median(d[max(0, i - 15):i + 15]) for i in range(len(d))])
cuts = [i + 1 for i in range(len(d)) if d[i] > max(12, 4 * med[i] + 4)]
# merge cuts closer than 3 frames
mc = []
for c in cuts:
    if not mc or c - mc[-1] > 3: mc.append(c)
bounds = [0] + mc + [n]
shots = np.diff(bounds)

# --- held frames / cadence: proportion of near-identical consecutive frames
# use a low-res noise-robust diff (blur) to ignore grain
small = Y.reshape(n, H // 4, 4, W // 4, 4).mean(axis=(2, 4))
ds = np.abs(np.diff(small, axis=0)).mean(axis=(1, 2))
hold_thr = 0.35
held = (ds < hold_thr)
# run lengths of 'change' patterns inside shots
def runs(mask):
    r, c = [], 0
    for m in mask:
        if m: c += 1
        else:
            if c: r.append(c)
            c = 0
    if c: r.append(c)
    return r
held_runs = runs(held)

# --- grain: residual of frame minus 3x3 box blur, in flat regions; temporal grain change
def box(a):
    p = np.pad(a, 1, mode="edge")
    return sum(p[i:i + a.shape[0], j:j + a.shape[1]] for i in range(3) for j in range(3)) / 9
grain = []
for i in range(0, n, 30):
    r = Y[i] - box(Y[i])
    grain.append(float(np.std(r)))

# --- camera: phase correlation translation + scale estimate per consecutive frame (sampled)
def phase(a, b):
    A = np.fft.fft2(a - a.mean()); B = np.fft.fft2(b - b.mean())
    R = A * np.conj(B); R /= np.abs(R) + 1e-6
    r = np.fft.ifft2(R).real
    y, x = np.unravel_index(np.argmax(r), r.shape)
    if y > H / 2: y -= H
    if x > W / 2: x -= W
    return x, y
def scale_test(a, b):
    best, bs = 1e9, 1.0
    for s in [0.99, 0.995, 0.998, 1.0, 1.002, 1.005, 1.01]:
        im = Image.fromarray(b.astype(np.uint8)).resize((int(W * s), int(H * s)), Image.BILINEAR)
        arr = np.asarray(im, np.float32)
        hh, ww = arr.shape
        if s >= 1:
            y0, x0 = (hh - H) // 2, (ww - W) // 2
            bb = arr[y0:y0 + H, x0:x0 + W]; aa = a
        else:
            y0, x0 = (H - hh) // 2, (W - ww) // 2
            aa = a[y0:y0 + hh, x0:x0 + ww]; bb = arr
        e = np.abs(aa[10:-10, 10:-10] - bb[10:-10, 10:-10]).mean()
        if e < best: best, bs = e, s
    return bs
cam = []
for si in range(len(bounds) - 1):
    a0, a1 = bounds[si], bounds[si + 1]
    if a1 - a0 < 6: continue
    tx = ty = 0; scs = []
    for i in range(a0, a1 - 1, 2):
        x, y = phase(small[i + 1] if False else Y[i + 1], Y[i])
        tx += x; ty += y
        if (i - a0) % 6 == 0: scs.append(scale_test(Y[i], Y[i + 1]))
    zoom = float(np.prod(scs)) ** (2 * 6 / 2 / max(1, len(scs)) * 0 + 1)  # product over samples
    zoom_per_sec = float(np.exp(np.mean(np.log(scs)) * 30)) if scs else 1
    cam.append(dict(start=a0, end=a1, len_s=round((a1 - a0) / 30, 2),
                    pan_px_per_s_320=[round(tx * 2 / ((a1 - a0) / 30), 1), round(ty * 2 / ((a1 - a0) / 30), 1)],
                    zoom_per_s=round(zoom_per_sec, 4),
                    held_frac=round(float(held[a0:a1 - 1].mean()), 2)))

# --- grade
idx = np.arange(0, n, 10)
lum = Y[idx]
p2, p98 = float(np.percentile(lum, 2)), float(np.percentile(lum, 98))
rgb = F[idx].astype(np.float32) / 255
mx, mn = rgb.max(-1), rgb.min(-1)
sat = np.where(mx > 0, (mx - mn) / (mx + 1e-6), 0)
# --- palette k-means
px = F[idx][:, ::4, ::4].reshape(-1, 3).astype(np.float32)
rng = np.random.default_rng(0)
px = px[rng.choice(len(px), 60000, replace=False)]
k = 12
C = px[rng.choice(len(px), k, replace=False)]
for _ in range(25):
    lab = np.argmin(((px[:, None] - C[None]) ** 2).sum(-1), 1)
    C = np.array([px[lab == j].mean(0) if (lab == j).any() else C[j] for j in range(k)])
cnt = np.bincount(lab, minlength=k)
order = np.argsort(-cnt)
pal = [dict(hex="#%02x%02x%02x" % tuple(int(v) for v in C[j]), share=round(float(cnt[j] / cnt.sum()), 3)) for j in order]

# vignette: corner vs centre luminance ratio
cy, cx = H // 2, W // 2
centre = Y[:, cy - 30:cy + 30, cx - 50:cx + 50].mean()
corners = np.concatenate([Y[:, :25, :40].ravel(), Y[:, :25, -40:].ravel(), Y[:, -25:, :40].ravel(), Y[:, -25:, -40:].ravel()]).mean()

res = dict(frames=n, cuts=mc, n_shots=len(shots),
           shot_len_s=dict(mean=round(float(shots.mean() / 30), 2), median=round(float(np.median(shots) / 30), 2),
                           min=round(float(shots.min() / 30), 2), max=round(float(shots.max() / 30), 2)),
           held_frac_overall=round(float(held.mean()), 3),
           held_run_hist={str(k): held_runs.count(k) for k in range(1, 8)},
           grain_std=round(float(np.median(grain)), 2),
           luma_p2=round(p2, 1), luma_p98=round(p98, 1), luma_mean=round(float(lum.mean()), 1),
           sat_mean=round(float(sat.mean()), 3), sat_p90=round(float(np.percentile(sat, 90)), 3),
           vignette_corner_over_centre=round(float(corners / centre), 3),
           palette=pal, shots=cam)
json.dump(res, open(f"{out}/metrics.json", "w"), indent=1)
np.save(f"{out}/diff_small.npy", ds)
print(json.dumps({k: v for k, v in res.items() if k != "shots"}, indent=1))
