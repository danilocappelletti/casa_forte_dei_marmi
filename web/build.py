import collections
import html
import pathlib

import ezdxf
from ezdxf import path as ezpath
from ezdxf.colors import aci2rgb

SRC = pathlib.Path(r"C:\Users\danil\Documents\PersonalWorks\nataledwg\dxf\x arredatrici.dxf")
OUT = pathlib.Path(__file__).with_name("index.html")
TOL = 0.5  # ponytail: flattening tolerance in drawing units, curves become polylines

doc = ezdxf.readfile(SRC)
msp = doc.modelspace()
bounds = [float("inf"), float("inf"), float("-inf"), float("-inf")]
skipped = collections.Counter()
layer_items = collections.defaultdict(list)


def grow(x, y):
    bounds[0] = min(bounds[0], x)
    bounds[1] = min(bounds[1], y)
    bounds[2] = max(bounds[2], x)
    bounds[3] = max(bounds[3], y)


def css_color(layer_name, idx):
    if idx in (0, 256):
        layer = doc.layers.get(layer_name)
        idx = abs(layer.dxf.color) if layer else 7
    if idx in (0, 7):
        return "#000000"
    r, g, b = aci2rgb(idx)
    return f"#{r:02x}{g:02x}{b:02x}"


def path_d(paths):
    parts = []
    for p in paths:
        for sub in p.sub_paths():
            coords = [(v.x, -v.y) for v in sub.flattening(TOL)]
            if not coords:
                continue
            for x, y in coords:
                grow(x, y)
            parts.append("M" + " L".join(f"{x:.3f},{y:.3f}" for x, y in coords))
    return " ".join(parts)


def add_element(layer, etype, handle, color, d=None, text=None):
    attrs = f'class="e" data-layer="{html.escape(layer)}" data-type="{etype}" data-handle="{handle}" stroke="{color}"'
    if text is None:
        body = f'<path {attrs} fill="none" d="{d}"/>'
    else:
        (x, y), height, value = text
        grow(x, -y)
        body = (f'<text {attrs} fill="{color}" stroke="none" font-size="{height:.3f}" '
                f'x="{x:.3f}" y="{-y:.3f}">{html.escape(value)}</text>')
    layer_items[layer].append(body)


def walk(entities):
    for e in entities:
        etype = e.dxftype()
        layer = e.dxf.get("layer", "0")
        handle = e.dxf.get("handle", "")
        color = css_color(layer, e.dxf.get("color", 256))
        try:
            if etype in ("INSERT", "DIMENSION"):
                walk(e.virtual_entities())
            elif etype == "TEXT":
                add_element(layer, etype, handle, color, text=((e.dxf.insert.x, e.dxf.insert.y), e.dxf.height, e.dxf.text))
            elif etype == "MTEXT":
                add_element(layer, etype, handle, color, text=((e.dxf.insert.x, e.dxf.insert.y), e.dxf.char_height, e.plain_text()))
            elif etype == "HATCH":
                d = path_d(ezpath.from_hatch(e))
                if d:
                    add_element(layer, etype, handle, color, d=d)
            elif etype in ("LINE", "ARC", "CIRCLE", "ELLIPSE", "LWPOLYLINE", "POLYLINE", "SPLINE"):
                d = path_d([ezpath.make_path(e)])
                if d:
                    add_element(layer, etype, handle, color, d=d)
            else:
                skipped[etype] += 1
        except Exception:
            skipped[etype] += 1


walk(msp)

min_x, min_y, max_x, max_y = bounds
pad = max(max_x - min_x, max_y - min_y) * 0.02
view = f"{min_x - pad:.3f} {min_y - pad:.3f} {max_x - min_x + 2 * pad:.3f} {max_y - min_y + 2 * pad:.3f}"

groups = []
for name in sorted(layer_items):
    items = "\n".join(layer_items[name])
    groups.append(f'<g data-layer="{html.escape(name)}">\n{items}\n</g>')

page = f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>x arredatrici</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<button id="toggle3d">Vista 3D</button>
<div id="view3d" hidden></div>
<button id="reset2d">Vista iniziale</button>
<main id="stage">
<svg id="drawing" xmlns="http://www.w3.org/2000/svg" viewBox="{view}">
{chr(10).join(groups)}
</svg>
</main>
<script src="three.min.js"></script>
<script src="OrbitControls.js"></script>
<script src="app.js"></script>
</body>
</html>
"""
OUT.write_text(page, encoding="utf-8")

total = sum(len(v) for v in layer_items.values())
print(f"written {OUT} with {total} elements in {len(layer_items)} layers")
print("skipped:", dict(skipped))
