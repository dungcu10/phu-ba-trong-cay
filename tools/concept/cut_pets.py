import json, sys
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

S = 4
import os
sess = new_session(os.environ.get('RB_MODEL', 'isnet-general-use'))

def cut(src, box, out, keep='main', pad=0):
    im = Image.open(src).convert('RGB')
    x0, y0, x1, y1 = [v * S for v in box]
    c = im.crop((x0, y0, x1, y1))
    r = remove(c, session=sess)
    a = np.array(r)
    al = a[:, :, 3].astype(np.float32)
    # drop components not joined to the main subject (labels, bits of neighbours), keep small sparks near it
    lab, n = ndimage.label(al > 40)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
        main = int(np.argmax(sizes)) + 1
        my, mx = np.where(lab == main)
        bb = (my.min(), my.max(), mx.min(), mx.max())
        for i in range(1, n + 1):
            if i == main:
                continue
            ys, xs = np.where(lab == i)
            rgb = a[ys, xs, :3].astype(np.float32)
            sat = (rgb.max(1) - rgb.min(1)).mean()
            near = ys.min() > bb[0] - 60 and ys.max() < bb[1] + 60 and xs.min() > bb[2] - 60 and xs.max() < bb[3] + 60
            if keep == 'main' or sat < 40 or not near:
                al[lab == i] = 0
    # edge clean-up: half-transparent near-grey pixels are background leftovers
    rgb = a[:, :, :3].astype(np.float32)
    sat = rgb.max(2) - rgb.min(2)
    edge = (al > 0) & (al < 250) & (sat < 22)
    al[edge] *= 0.15
    a[:, :, 3] = al.clip(0, 255).astype(np.uint8)
    img = Image.fromarray(a)
    bbx = img.getbbox()
    img = img.crop(bbx)
    img.save(out)
    return {'crop': [x0 + bbx[0], y0 + bbx[1]], 'size': img.size}

job = json.load(open(sys.argv[1]))
meta = {}
for name, (src, box, keep) in job.items():
    meta[name] = cut(src, box, f'out/cut/{name}.png', keep)
    print(name, meta[name], flush=True)
json.dump(meta, open('out/cut/meta.json', 'w'), indent=1)
