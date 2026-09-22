"""Restyle Contactless.json to the Slate app look.

- Card becomes the app's brushed Platinum plate: warm metal gradient, polished
  rim, ink contactless mark and a Visa wordmark. All the placeholder printing
  (chip, brand circles, XXXX number, EXPIRES, CARD, ...) is removed.
- Terminal goes graphite with light keys, on a soft neutral shadow.
- The tick turns the app's positive green and stays up after the card leaves.

Regenerate with:
  python3 tool/restyle_contactless.py \
    assets/images/source/Contactless_original.json \
    assets/images/Contactless.json \
    assets/images/visa.svg
"""
import json, re, sys

SRC, DST = sys.argv[1], sys.argv[2]
d = json.load(open(SRC))
# The card is gone by frame 93; end shortly after so the hold starts sooner.
d['op'] = 100
for layer in d['layers']:
    layer['op'] = min(layer['op'], d['op'] + 1)


def rgb(h, a=1):
    h = h.lstrip('#')
    return [round(int(h[i:i + 2], 16) / 255, 4) for i in (0, 2, 4)] + [a]


def groups(items, out=None):
    out = {} if out is None else out
    for it in items:
        if it.get('ty') == 'gr':
            out[it['nm']] = it
            groups(it['it'], out)
    return out


layers = {l['nm']: l for l in d['layers']}
card, check, terminal = layers['Laag 2'], layers['Group 391'], layers['Laag 1']
card['nm'], check['nm'], terminal['nm'] = 'Card', 'Check', 'Terminal'

# ---------------------------------------------------------------- terminal
T = groups(terminal['shapes'])


def fill(g, hexc, opacity=100):
    for i, it in enumerate(g['it']):
        if it['ty'] in ('fl', 'gf'):
            g['it'][i] = {'ty': 'fl', 'nm': 'Fill', 'c': {'a': 0, 'k': rgb(hexc)},
                          'o': {'a': 0, 'k': opacity}, 'r': 1, 'bm': 0, 'hd': False}


def grad(g, stops):
    for it in g['it']:
        if it['ty'] == 'gf':
            k = []
            for p, h in stops:
                k += [p] + rgb(h)[:3]
            it['g'] = {'p': len(stops), 'k': {'a': 0, 'k': k}}
            it['nm'] = 'Fill'


GRAPHITE_DEEP = [(0, '#0C0C0D'), (0.5, '#161618'), (1, '#202022')]
GRAPHITE_LIT = [(0, '#E2E0DC'), (0.5, '#6F6E6B'), (1, '#2A2A2C')]

fill(T['Path 1197'], '#2A2A2C')                         # grip outline
grad(T['Path 1196'], GRAPHITE_DEEP)                     # side grip
fill(T['Path 1195'], '#E2E0DC')                         # paper roll
grad(T['Path 1191'], [(0, '#E9E8E5'), (0.5, '#F7F6F4'), (1, '#FFFFFF')])  # receipt
for n in ('Rectangle 42', 'Rectangle 41', 'Rectangle 40', 'Path 1194', 'Path 1193', 'Path 1192'):
    fill(T[n], '#DCDBD8')                               # receipt lines
fill(T['Path 1190'], '#4A4A4D')                         # paper slot
for n in ('Path 1189', 'Path 1188', 'Path 1187', 'Path 1186', 'Path 1185'):
    fill(T[n], '#5A5A5E')                               # function strip keys
for n in ('Path 1184', 'Path 1183', 'Path 1182', 'Path 1181', 'Path 1180'):
    fill(T[n], '#070707')
for n in ('Path 1178', 'Path 1177', 'Path 1176', 'Path 1175', 'Path 1173', 'Path 1172',
          'Path 1171', 'Path 1170', 'Path 1168', 'Path 1167', 'Path 1166', 'Path 1165'):
    fill(T[n], '#ECEBE8')                               # number keys
fill(T['Path 1174'], '#8E8E93')                         # cancel
fill(T['Path 1179'], '#C2C1BE')                         # clear
fill(T['Path 1169'], '#12B76A')                         # confirm
for n in [f'Path {i}' for i in range(1150, 1165)]:
    fill(T[n], '#070707')                               # key shadows
fill(T['Path 1149'], '#DCDBD8')                         # screen inner edge
fill(T['Path 1148'], '#FFFFFF')                         # screen
grad(T['Path 1147'], GRAPHITE_DEEP)                     # screen bezel
grad(T['Path 1146'], GRAPHITE_LIT)                      # top shell
fill(T['Path 1145'], '#141416')
fill(T['Path 1144'], '#070707')
grad(T['Path 1143'], [(p, c) for (p, _), (_, c) in zip(GRAPHITE_DEEP, reversed(GRAPHITE_DEEP))])
grad(T['Path 1142'], [(0, '#2A2A2C'), (0.5, '#8A8986'), (1, '#E2E0DC')])  # base rim
fill(T['Path 1141'], '#DCDBD8')
grad(T['Path 1140'], [(p, c) for (p, _), (_, c) in zip(GRAPHITE_DEEP, reversed(GRAPHITE_DEEP))])
fill(T['Path 1139'], '#000000', opacity=9)              # ground shadow

# ------------------------------------------------------------------- check
fill(groups(check['shapes'])['Path 1198'], '#12B76A')
groups(check['shapes'])['Path 1198']['nm'] = 'Tick'
check['op'] = d['op'] + 1  # hold the tick once the card has gone

# -------------------------------------------------------------------- card
C = groups(card['shapes'])
face, edge = C['Path 1201'], C['Path 1199']
waves = [C['Path 1260'], C['Path 1259'], C['Path 1258']]
face['nm'], edge['nm'] = 'Face', 'Edge'
for i, w in enumerate(waves):
    w['nm'] = f'Wave {i + 1}'
    fill(w, '#1F1D1A', opacity=80)

# Card corners, from the straight runs of the face outline.
fv = next(i for i in face['it'] if i['ty'] == 'sh')['ks']['k']['v']
fp = next(i for i in face['it'] if i['ty'] == 'tr')['p']['k']


def line(a, b):
    return a, (b[0] - a[0], b[1] - a[1])


def meet(l1, l2):
    (p, r), (q, s) = l1, l2
    cross = r[0] * s[1] - r[1] * s[0]
    t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / cross
    return (p[0] + t * r[0], p[1] + t * r[1])


top = line(fv[4], fv[2])      # left corner -> top corner (long edge)
right = line(fv[1], fv[0])    # top corner -> right corner (short edge)
bottom = line(fv[7], fv[8])   # bottom corner -> right corner (long edge)
left = line(fv[5], fv[6])     # left corner -> bottom corner (short edge)
TL, TR, BR, BL = meet(top, left), meet(top, right), meet(right, bottom), meet(bottom, left)
U = (TR[0] - TL[0], TR[1] - TL[1])
V = (BL[0] - TL[0], BL[1] - TL[1])
aspect = (U[0] ** 2 + U[1] ** 2) ** 0.5 / (V[0] ** 2 + V[1] ** 2) ** 0.5


def to_card(x, y):
    """Normalised card position (0..1 along the long and short edge) -> face space."""
    return [TL[0] + x * U[0] + y * V[0], TL[1] + x * U[1] + y * V[1]]


def along(dx, dy):
    return [dx * U[0] + dy * V[0], dx * U[1] + dy * V[1]]


# Face: the app's Platinum gradient, top-left to bottom-right, plus the rim.
face_stops = [(0, '#BBB7B0'), (0.30, '#B1ADA6'), (0.52, '#AAA69F'), (0.76, '#AEAAA3'), (1, '#A5A19A')]
k = []
for p, h in face_stops:
    k += [p] + rgb(h)[:3]
for i, it in enumerate(face['it']):
    if it['ty'] == 'fl':
        face['it'][i] = {'ty': 'gf', 'nm': 'Metal', 'o': {'a': 0, 'k': 100}, 'r': 1, 'bm': 0,
                         'g': {'p': len(face_stops), 'k': {'a': 0, 'k': k}},
                         's': {'a': 0, 'k': to_card(0, 0)}, 'e': {'a': 0, 'k': to_card(1, 1)},
                         't': 1, 'hd': False}
tr_index = next(i for i, it in enumerate(face['it']) if it['ty'] == 'tr')
face['it'].insert(tr_index, {'ty': 'st', 'nm': 'Rim', 'c': {'a': 0, 'k': [1, 1, 1, 1]},
                             'o': {'a': 0, 'k': 30}, 'w': {'a': 0, 'k': 0.7},
                             'lc': 2, 'lj': 2, 'bm': 0, 'hd': False})
fill(edge, '#86827B')
next(i for i in edge['it'] if i['ty'] == 'fl')['nm'] = 'Metal'

# Visa wordmark, projected onto the plate at the bottom right.
svg = open(sys.argv[3]).read()
path_d = re.search(r' d="([^"]+)"', svg).group(1)
tokens = re.findall(r'[MmLlHhVvCcSsZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?', path_d)

subpaths, cur, pos, start, last_ctrl, cmd = [], None, (0, 0), (0, 0), None, None
idx = 0


def num():
    global idx
    v = float(tokens[idx]); idx += 1
    return v


while idx < len(tokens):
    if re.match(r'[A-Za-z]', tokens[idx]):
        cmd = tokens[idx]; idx += 1
    rel = cmd.islower()
    C_ = cmd.upper()
    ox, oy = pos if rel else (0, 0)
    if C_ == 'Z':
        if cur:
            subpaths.append(cur)
        cur, pos, last_ctrl = None, start, None
        continue
    if C_ == 'M':
        pos = (ox + num(), oy + num()); start = pos
        cur = {'v': [pos], 'i': [(0, 0)], 'o': [(0, 0)]}
        cmd = 'l' if rel else 'L'; last_ctrl = None
        continue
    if C_ in ('L', 'H', 'V'):
        if C_ == 'L':
            p = (ox + num(), oy + num())
        elif C_ == 'H':
            p = ((pos[0] if rel else 0) + num(), pos[1])
        else:
            p = (pos[0], (pos[1] if rel else 0) + num())
        cur['v'].append(p); cur['i'].append((0, 0)); cur['o'].append((0, 0))
        pos, last_ctrl = p, None
        continue
    if C_ in ('C', 'S'):
        if C_ == 'C':
            c1 = (ox + num(), oy + num())
        else:
            c1 = (2 * pos[0] - last_ctrl[0], 2 * pos[1] - last_ctrl[1]) if last_ctrl else pos
        c2 = (ox + num(), oy + num())
        p = (ox + num(), oy + num())
        cur['o'][-1] = (c1[0] - pos[0], c1[1] - pos[1])
        cur['v'].append(p); cur['i'].append((c2[0] - p[0], c2[1] - p[1])); cur['o'].append((0, 0))
        pos, last_ctrl = p, c2
        continue
    raise ValueError(cmd)
if cur:
    subpaths.append(cur)

VB_X, VB_Y, VB_W, VB_H = 0.5, 0.5, 999, 323.684
logo_w = 0.25                                  # of the long edge
logo_h = logo_w * aspect * VB_H / VB_W         # of the short edge
right_x, bottom_y = 1 - 0.075, 1 - 0.13
x0, y0 = right_x - logo_w, bottom_y - logo_h

visa_items = []
for n, sp in enumerate(subpaths):
    v, i_, o_ = sp['v'], sp['i'], sp['o']
    # Drop the duplicate end point a closing segment leaves behind.
    if len(v) > 1 and abs(v[-1][0] - v[0][0]) < 1e-6 and abs(v[-1][1] - v[0][1]) < 1e-6:
        i_[0] = i_[-1]; v, i_, o_ = v[:-1], i_[:-1], o_[:-1]
    sx, sy = logo_w / VB_W, logo_h / VB_H
    visa_items.append({'ty': 'sh', 'nm': f'Letter {n + 1}', 'ks': {'a': 0, 'k': {
        'c': True,
        'v': [to_card(x0 + (px - VB_X) * sx, y0 + (py - VB_Y) * sy) for px, py in v],
        'i': [along(dx * sx, dy * sy) for dx, dy in i_],
        'o': [along(dx * sx, dy * sy) for dx, dy in o_],
    }}, 'hd': False})
visa_items += [
    {'ty': 'fl', 'nm': 'Ink', 'c': {'a': 0, 'k': rgb('#1F1D1A')}, 'o': {'a': 0, 'k': 100}, 'r': 1, 'bm': 0, 'hd': False},
    {'ty': 'tr', 'p': {'a': 0, 'k': fp}, 'a': {'a': 0, 'k': [0, 0]}, 's': {'a': 0, 'k': [100, 100]},
     'r': {'a': 0, 'k': 0}, 'o': {'a': 0, 'k': 100}, 'sk': {'a': 0, 'k': 0}, 'sa': {'a': 0, 'k': 0}, 'nm': 'Transform'},
]
visa = {'ty': 'gr', 'nm': 'Visa', 'it': visa_items, 'np': len(visa_items), 'cix': 2, 'bm': 0, 'ix': 1, 'hd': False}

# Keep only the plate, its edge and the contactless mark; the Visa sits on top.
card['shapes'] = [visa] + waves + [face, edge]

d['nm'] = 'slate_contactless'
d['meta'] = {'g': 'Slate'}
json.dump(d, open(DST, 'w'), separators=(',', ':'))
print('aspect', round(aspect, 3), 'TL', TL, 'TR', TR, 'BR', BR, 'BL', BL, 'subpaths', len(subpaths))
