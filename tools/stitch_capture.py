"""Rebuild a 1344x768 Leonardo original from two 1:1 browser captures (viewport 929 wide):
left tile shows image x 0..929, right tile shows x 415..1344. Usage:
python3 tools/stitch_capture.py left.jpg right.jpg out.jpg"""
import sys
from PIL import Image

W, H, VW = 1344, 768, 929
left, right, out = sys.argv[1:4]
a = Image.open(left).convert('RGB').crop((0, 0, VW, H))
b = Image.open(right).convert('RGB').crop((0, 0, VW, H))
img = Image.new('RGB', (W, H))
img.paste(b, (W - VW, 0))
# Left tile wins where they overlap, except a soft seam is unnecessary: both are the same pixels.
img.paste(a, (0, 0))
img.save(out, quality=95)
print(out, img.size)
