"""Restyle loading.json to the Slate app look.

- Dots take the Platinum card's metal tone, so they read like the home card
  sitting on its black header.
- The zero-width outline strokes are dropped: Flutter paints a 0 width stroke
  as a one pixel hairline, which rims every dot.
- The square artboard is cropped to the band the dots travel in, so the
  animation can sit inside a button without any padding maths.
- The hidden duplicate layer past the end of the loop is removed.

Regenerate with:
  python3 tool/restyle_loading.py \
    assets/images/source/loading.json \
    assets/images/loading.json
"""
import json
import sys

SRC, DST = sys.argv[1], sys.argv[2]
d = json.load(open(SRC))

PLATINUM = '#B1ADA6'

# Where the dots travel on the original 428 x 428 artboard, measured across
# the whole loop, with a little breathing room.
BAND_TOP, BAND_HEIGHT = 140.5, 150


def rgb(h):
    h = h.lstrip('#')
    return [round(int(h[i:i + 2], 16) / 255, 4) for i in (0, 2, 4)] + [1]


def restyle(items):
    kept = []
    for it in items:
        if it.get('ty') == 'st':
            continue
        if it.get('ty') == 'fl':
            it['c'] = {'a': 0, 'k': rgb(PLATINUM)}
            it['nm'] = 'Fill'
        if it.get('ty') == 'gr':
            it['it'] = restyle(it['it'])
            it['np'] = len(it['it'])
        kept.append(it)
    return kept


for asset in d['assets']:
    for layer in asset.get('layers', []):
        layer['shapes'] = restyle(layer.get('shapes', []))

d['layers'] = [l for l in d['layers'] if not l.get('hd')]
for layer in d['layers']:
    layer['ks']['p']['k'][1] -= BAND_TOP
d['h'] = BAND_HEIGHT
d['nm'] = 'slate_loading'

json.dump(d, open(DST, 'w'), separators=(',', ':'), ensure_ascii=False)
print('artboard', d['w'], 'x', d['h'])
