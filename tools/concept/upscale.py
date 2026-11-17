import sys, torch, numpy as np
from PIL import Image
from spandrel import ModelLoader
torch.set_num_threads(2)
model = ModelLoader().load_from_file(sys.argv[1]).eval()
im = Image.open(sys.argv[2]).convert('RGB')
x = torch.from_numpy(np.asarray(im).astype(np.float32) / 255).permute(2, 0, 1)[None]
T, PAD, S = 192, 16, 4
_, _, H, Wd = x.shape
out = torch.zeros(1, 3, H * S, Wd * S)
with torch.no_grad():
    for y0 in range(0, H, T):
        for x0 in range(0, Wd, T):
            ya, xa = max(0, y0 - PAD), max(0, x0 - PAD)
            yb, xb = min(H, y0 + T + PAD), min(Wd, x0 + T + PAD)
            o = model(x[:, :, ya:yb, xa:xb])
            oy, ox = (y0 - ya) * S, (x0 - xa) * S
            h, w = min(T, H - y0) * S, min(T, Wd - x0) * S
            out[:, :, y0 * S:y0 * S + h, x0 * S:x0 * S + w] = o[:, :, oy:oy + h, ox:ox + w]
        print('row', y0, flush=True)
Image.fromarray((out[0].permute(1, 2, 0).clamp(0, 1).numpy() * 255).round().astype(np.uint8)).save(sys.argv[3])
