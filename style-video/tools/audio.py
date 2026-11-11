"""Audio analysis: tempo (onset autocorrelation), spectral centroid, band energies,
syllable-rate modulation (voice hint), sharp events. Usage: python -I audio.py <media>"""
import sys, subprocess, json
import numpy as np
sr = 22050
raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", sys.argv[1], "-ac", "1", "-ar", str(sr),
                      "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, np.float32)
hop, win = 512, 2048
nfr = (len(x) - win) // hop
w = np.hanning(win)
S = np.abs(np.array([np.fft.rfft(x[i * hop:i * hop + win] * w) for i in range(nfr)]))
f = np.fft.rfftfreq(win, 1 / sr)
cent = (S * f).sum(1) / (S.sum(1) + 1e-9)
rms = np.sqrt((S ** 2).mean(1))
band = lambda lo, hi: (S[:, (f >= lo) & (f < hi)] ** 2).sum(1)
tot = (S ** 2).sum(1) + 1e-9
shares = {k: float((band(*v) / tot).mean()) for k, v in
          dict(sub=(20, 80), low=(80, 300), voice=(300, 3400), high=(3400, 11000)).items()}
# onset envelope
L = np.log1p(S * 10)
flux = np.maximum(0, np.diff(L, axis=0)).sum(1)
flux = flux - np.convolve(flux, np.ones(43) / 43, "same")
flux = np.maximum(flux, 0)
fps = sr / hop
ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
lags = np.arange(len(ac)) / fps
bpm_range = (lags > 60 / 160) & (lags < 60 / 60)
best = lags[bpm_range][np.argmax(ac[bpm_range])]
# syllable-rate modulation of voice band (3-6 Hz) vs total
vb = band(300, 3400)
env = vb / vb.max()
E = np.abs(np.fft.rfft(env - env.mean()))
fm = np.fft.rfftfreq(len(env), 1 / fps)
mod_ratio = float(E[(fm > 3) & (fm < 7)].mean() / E[(fm > 0.5) & (fm < 2.5)].mean())
# sharp events: flux peaks > mean+4std
thr = flux.mean() + 4 * flux.std()
ev = [round(i / fps, 2) for i in range(1, len(flux) - 1) if flux[i] > thr and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1]]
print(json.dumps(dict(duration=round(len(x) / sr, 1), tempo_bpm=round(60 / best, 1),
                      centroid_hz_median=round(float(np.median(cent)), 0),
                      band_shares={k: round(v, 3) for k, v in shares.items()},
                      syllable_mod_ratio=round(mod_ratio, 2), sharp_events_n=len(ev), sharp_events_first=ev[:25],
                      rms_db_p10_p90=[round(float(20 * np.log10(np.percentile(rms, p) + 1e-9)), 1) for p in (10, 90)]),
                 indent=1))
