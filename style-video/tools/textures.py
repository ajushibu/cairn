"""Grain frames + mottle texture for the film. Usage: python -I textures.py <publicdir>"""
import sys, numpy as np
from PIL import Image, ImageFilter
out = sys.argv[1]; W, H = 1080, 1920
rng = np.random.default_rng(7)
for i in range(8):
    g = rng.normal(0, 1, (H, W)).astype(np.float32)
    im = Image.fromarray(np.clip(128 + g * 40, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    a = np.asarray(im, np.float32); a = 128 + (a - 128) * (40 / a.std())
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f"{out}/grain{i}.png")
# mottle: sum of upsampled noise octaves -> airbrush blotches
m = np.zeros((H, W), np.float32)
for s, amp in [(240, 1.0), (120, .7), (60, .45), (24, .25)]:
    n = rng.normal(0, 1, (H // s + 2, W // s + 2)).astype(np.float32)
    up = Image.fromarray(n).resize(((W // s + 2) * s, (H // s + 2) * s), Image.BICUBIC)
    m += amp * np.asarray(up)[:H, :W]
m = (m - m.mean()) / m.std()
Image.fromarray(np.clip(128 + m * 34, 0, 255).astype(np.uint8)).save(f"{out}/mottle.png")
print("ok")
