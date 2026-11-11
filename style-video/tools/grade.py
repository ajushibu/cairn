"""Grade numbers for still images. Usage: python -I grade.py img..."""
import sys, numpy as np
from PIL import Image
for p in sys.argv[1:]:
    a = np.asarray(Image.open(p).convert('RGB').resize((180, 320)), np.float32)
    Y = a @ [.299, .587, .114]
    mx, mn = a.max(-1), a.min(-1); sat = (mx - mn) / (mx + 1e-6)
    H, W = Y.shape; c = Y[H//2-40:H//2+40, W//2-30:W//2+30].mean()
    k = np.concatenate([Y[:40,:25].ravel(), Y[:40,-25:].ravel(), Y[-40:,:25].ravel(), Y[-40:,-25:].ravel()]).mean()
    from PIL import ImageFilter
    big = np.asarray(Image.open(p).convert('L').resize((180, 320)), np.float32)
    bl = np.asarray(Image.fromarray(big.astype(np.uint8)).filter(ImageFilter.BoxBlur(1)), np.float32)
    print(p.split('/')[-1], 'p2 %.1f p98 %.1f mean %.1f sat %.3f vign %.2f texture %.2f' % (np.percentile(Y,2), np.percentile(Y,98), Y.mean(), sat.mean(), k/c, (big-bl).std()))
