const svg = document.getElementById("drawing");
const stage = document.getElementById("stage");
const initial = svg.getAttribute("viewBox").split(" ").map(Number);
const view = { x: initial[0], y: initial[1], w: initial[2], h: initial[3] };

function applyView() {
  svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
}

function toSvgPoint(clientX, clientY) {
  const r = svg.getBoundingClientRect();
  return { x: view.x + ((clientX - r.left) / r.width) * view.w, y: view.y + ((clientY - r.top) / r.height) * view.h };
}

svg.addEventListener("wheel", (e) => {
  e.preventDefault();
  const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
  const p = toSvgPoint(e.clientX, e.clientY);
  view.x = p.x - (p.x - view.x) * k;
  view.y = p.y - (p.y - view.y) * k;
  view.w *= k;
  view.h *= k;
  applyView();
}, { passive: false });

let drag = null;

stage.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
});

window.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const r = svg.getBoundingClientRect();
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) stage.classList.add("dragging");
  view.x = drag.vx - (dx / r.width) * view.w;
  view.y = drag.vy - (dy / r.height) * view.h;
  applyView();
});

window.addEventListener("pointerup", () => {
  drag = null;
  stage.classList.remove("dragging");
});

// Colorazione dei tre prospetti, disegnata sotto le linee del CAD.
// Coordinate dei prospetti lette in pixel da screenshot (41.57 px/unità, viewBox largo 28 con origine vx) e convertite qui.
{
  const PX = 41.57;
  const WALL = "#f1e6d2", ROOF = "#b5543a", GLASS = "#a9d6e8", BRICK = "#c98a6b", STONE = "#cfcfcf", WOOD = "#8a5a3a", TERRA = "#c8714a";
  const poly = (vx, fill, pts, o = 1) => {
    const p = [];
    for (let i = 0; i < pts.length; i += 2) p.push(`${(vx + (pts[i] - 240) / PX).toFixed(3)},${(-823 + (pts[i + 1] - 316) / PX).toFixed(3)}`);
    return `<polygon points="${p.join(" ")}" fill="${fill}" fill-opacity="${o}"/>`;
  };
  const box = (vx, fill, x0, x1, y0, y1, o = 1) => poly(vx, fill, [x0, y0, x1, y0, x1, y1, x0, y1], o);

  let s = "";
  // Lato mare
  let v = 2023;
  s += box(v, WALL, 426, 725, 421, 685) + box(v, WALL, 725, 857, 440, 685);
  s += poly(v, ROOF, [383, 421, 548, 371, 707, 364, 857, 364, 857, 421]);
  s += box(v, GLASS, 708, 850, 368, 417, 0.8);
  s += box(v, BRICK, 857, 890, 350, 650) + box(v, STONE, 845, 900, 322, 352);
  for (const [a, b, c, d] of [[475, 537, 440, 502], [586, 648, 440, 502], [797, 850, 440, 548], [458, 545, 572, 680], [617, 698, 572, 680], [750, 802, 572, 680]])
    s += box(v, GLASS, a, b, c, d, 0.85);
  s += box(v, STONE, 400, 870, 685, 708);
  // Lato massa
  v = 1999.5;
  s += box(v, WALL, 643, 1062, 425, 543) + box(v, WALL, 643, 1103, 543, 685) + box(v, WALL, 548, 643, 563, 667);
  s += poly(v, ROOF, [600, 433, 650, 418, 828, 365, 1008, 418, 1063, 436]) + box(v, ROOF, 533, 643, 556, 563);
  s += box(v, GLASS, 758, 852, 390, 417, 0.8) + box(v, GLASS, 370, 548, 630, 705, 0.7);
  s += box(v, GLASS, 975, 1003, 438, 505, 0.85) + box(v, GLASS, 970, 1020, 563, 685, 0.85);
  s += box(v, BRICK, 1002, 1026, 350, 420) + box(v, STONE, 993, 1035, 340, 358) + box(v, TERRA, 1062, 1103, 505, 543);
  s += box(v, STONE, 560, 685, 685, 708) + box(v, STONE, 900, 1210, 685, 708);
  // Lato monti
  v = 2046;
  s += box(v, WALL, 958, 1338, 431, 507) + box(v, WALL, 958, 1062, 507, 565) + box(v, WALL, 958, 1338, 565, 708);
  s += poly(v, ROOF, [890, 364, 1058, 364, 1062, 371, 1218, 371, 1382, 419, 1090, 424, 1088, 431, 890, 431]);
  s += box(v, STONE, 1060, 1400, 507, 563) + box(v, WOOD, 1045, 1317, 557, 565);
  s += box(v, GLASS, 1010, 1104, 390, 417, 0.8) + box(v, GLASS, 1170, 1265, 390, 417, 0.8) + box(v, GLASS, 1122, 1152, 380, 392, 0.8);
  for (const [a, b, c, d] of [[983, 1010, 438, 507], [1232, 1268, 438, 507], [960, 1008, 572, 637], [1134, 1157, 615, 637], [1220, 1280, 572, 667]])
    s += box(v, GLASS, a, b, c, d, 0.85);
  s += box(v, STONE, 1025, 1303, 667, 708) + box(v, "#6b6b6b", 887, 932, 625, 708, 0.6);

  // Terrazzo lato mare (unità disegno)
  const T = -818.46, F = -817.57, B = -817.07; // sommità parapetto, piano calpestio, intradosso
  const r = (x0, x1, y0, y1, fill, o = 1) =>
    `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${fill}" fill-opacity="${o}"/>`;
  s += r(2025.96, 2027.49, T, F, "#efe3cf") + r(2025.96, 2027.49, F, B, "#c7bba8") + r(2025.96, 2027.49, F - 0.04, F, WOOD);
  s += r(2028.45, 2033.68, F, F + 0.1, "#b08a63") + r(2028.45, 2033.68, F + 0.1, F + 0.13, "#000", 0.2);
  s += r(2027.49, 2028.5, T, F, TERRA) + r(2033.61, 2034.68, T, F, TERRA);

  svg.insertAdjacentHTML("afterbegin", `<g id="decor" pointer-events="none">${s}</g>`);
  document.querySelectorAll('path.e[stroke="#808080"]').forEach((p) => {
    const b = p.getBBox();
    if (b.x > 2017 && b.x < 2036 && b.y > -820.5 && b.y < -818) p.setAttribute("stroke", "#2e7d32");
  });
}

// Testi troppo lunghi per il loro riquadro nel cartiglio/tabella: vanno a capo e sono centrati nel riquadro (coordinate del disegno)
const wrapText = (prefix, box, gap) => {
  const t = [...svg.querySelectorAll("text")].find((el) => el.textContent.trim().startsWith(prefix));
  if (!t) return;
  const [left, right, top, bottom] = box;
  const x = (left + right) / 2;
  const y = parseFloat(t.getAttribute("y"));
  const maxW = right - left - 0.4;
  const fits = (s) => { t.textContent = s; return t.getBBox().width <= maxW; };
  const out = [];
  for (const line of t.textContent.split("\n").map((s) => s.trim()).filter(Boolean)) {
    let cur = "";
    for (const w of line.split(/\s+/)) {
      const cand = cur ? `${cur} ${w}` : w;
      if (cur && !fits(cand)) { out.push(cur); cur = w; } else cur = cand;
    }
    out.push(cur);
  }
  t.textContent = "";
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("stroke", "none");
  const tspans = out.map((s, i) => {
    const ts = document.createElementNS(svg.namespaceURI, "tspan");
    ts.setAttribute("x", x);
    ts.setAttribute("y", y + i * gap);
    ts.textContent = s;
    t.append(ts);
    return ts;
  });
  const b = t.getBBox();
  const dy = (top + bottom) / 2 - (b.y + b.height / 2);
  for (const ts of tspans) ts.setAttribute("y", parseFloat(ts.getAttribute("y")) + dy);
};
wrapText("RISTRUTTURAZIONE EDILIZIA", [2102.9, 2113.6, -839.3, -836.1], 0.42);
wrapText("VERIFICA PERMEABILITA'", [2068.2, 2081.7, -855.98, -850.78], 0.5);

// Colori dei due prospetti di recinzione (Via Verdi e Viale Italico): pilastri intonacati, copertine in pietra, cancelli e doghe in ferro
{
  const CREAM = "#f4ecdb", STONE_C = "#d8c4a2", IRON_C = "#5b7a66", IRON_D = "#4a6654", LIGHT = "#c9bfae";
  const R = (x0, x1, y0, y1, fill) => `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${fill}"/>`;
  let s = "";
  // Via Verdi
  s += R(2063.74, 2065.16, -844.64, -840.57, CREAM) + R(2063.6, 2065.3, -844.8, -844.64, STONE_C);
  s += R(2065.16, 2068.63, -844.55, -840.66, IRON_C) + R(2068.84, 2071.89, -844.55, -840.66, IRON_C);
  s += R(2072.1, 2073.56, -844.64, -840.57, CREAM) + R(2071.9, 2073.8, -844.8, -844.64, STONE_C);
  s += R(2072.33, 2073.36, -843.2, -842.2, LIGHT);
  s += R(2073.56, 2089.18, -844.55, -841.37, IRON_D);
  // Viale Italico
  s += R(2069.13, 2070.64, -832.49, -828.43, CREAM) + R(2069, 2070.8, -832.63, -832.49, STONE_C);
  s += R(2070.68, 2073.15, -832.3, -828.59, IRON_C);
  s += R(2073.19, 2074.61, -832.49, -828.43, CREAM) + R(2073.1, 2074.7, -832.63, -832.49, STONE_C);
  s += R(2074.61, 2086.85, -832.35, -829.23, IRON_D);
  s += R(2067.56, 2069.13, -832.35, -829.23, IRON_D) + R(2067.35, 2069.18, -829.33, -829.23, STONE_C);
  svg.insertAdjacentHTML("afterbegin", `<g id="decor2d" pointer-events="none">${s}</g>`);
}

// Pianta copertura: falde in coppi, pannelli fotovoltaici e solare termico, comignolo (coordinate ricavate dal disegno)
{
  const U = (px, py) => `${(2024 + px / 55.5).toFixed(3)},${(-842 + (py - 66.3) / 55.5).toFixed(3)}`;
  const poly = (pts, fill) => `<polygon points="${pts.map(([a, b]) => U(a, b)).join(" ")}" fill="${fill}"/>`;
  const rect = (x0, y0, x1, y1, fill) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], fill);
  let s = poly([[692, 272], [1060, 272], [1060, 217], [1348, 217], [1348, 827], [1085, 827], [1085, 765], [875, 765], [875, 705], [692, 714]], "#c0694a");
  s += poly([[692, 272], [910, 492], [692, 714]], "#a85a40");
  s += rect(849, 295, 975, 406, "#2d4a6b") + rect(1064, 295, 1189, 406, "#4f7fa0") + rect(713, 431, 825, 556, "#2d4a6b") + rect(1128, 541, 1316, 763, "#2d4a6b");
  s += rect(1000, 398, 1039, 453, "#bdb5a6");
  svg.insertAdjacentHTML("afterbegin", `<g id="decor-roof" pointer-events="none">${s}</g>`);
}

const btn3d = document.getElementById("toggle3d");
const view3d = document.getElementById("view3d");
let loaded3d = false;
btn3d.addEventListener("click", () => {
  const on = view3d.hidden;
  if (on && !loaded3d) {
    loaded3d = true;
    view3d.hidden = false;
    document.head.append(Object.assign(document.createElement("script"), { src: "view3d.js" }));
  }
  view3d.hidden = !on;
  stage.hidden = on;
  btn3d.textContent = on ? "Vista 2D" : "Vista 3D";
  window.dispatchEvent(new Event("resize"));
});
