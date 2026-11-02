// Modello 3D semplificato (volumi estrusi dalle piante, finestre solo sul lato mare).
// Coordinate = quelle del disegno: x verso destra, z = y SVG (sud in basso), y = quota dal piano campagna.
(() => {
  const WALL = 0xf1e6d2, ROOF = 0xb5543a, GLASS = 0x9fd0e6, TERRA = 0xc8714a, STONE = 0xcfcfcf, WOOD = 0x8a5a3a;
  const H1 = 3.97, H2 = 6.95; // solaio primo piano, gronda
  const group = new THREE.Group();
  const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, ...extra });
  const add = (geo, color, extra) => { const m = new THREE.Mesh(geo, mat(color, extra)); group.add(m); return m; };

  const box = (x0, x1, z0, z1, y0, y1, color, extra) => {
    const m = add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), color, extra);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  };
  const prism = (pts, y0, y1, color) => {
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0, 0);
    add(g, color);
  };
  // Tetto dal contorno della pianta di copertura: quota = gronda + pendenza * distanza dal bordo (falde e colmi, come un tetto a padiglione)
  const roofs = [];
  const roofFromPlan = (poly, eave, pitch, step) => {
    const segs = poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
    const inside = (x, z) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
      }
      return c;
    };
    const dist = (x, z) => Math.min(...segs.map(([[ax, az], [bx, bz]]) => {
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(x - ax - t * dx, z - az - t * dz);
    }));
    const x0 = Math.min(...poly.map((p) => p[0])), z0 = Math.min(...poly.map((p) => p[1]));
    const nx = Math.ceil((Math.max(...poly.map((p) => p[0])) - x0) / step);
    const nz = Math.ceil((Math.max(...poly.map((p) => p[1])) - z0) / step);
    const pos = [], idx = new Map(), ind = [];
    const vert = (i, j) => {
      const key = i * (nz + 1) + j;
      if (!idx.has(key)) {
        const x = x0 + i * step, z = z0 + j * step;
        idx.set(key, pos.length / 3);
        pos.push(x, eave + (inside(x, z) ? pitch * dist(x, z) : 0), z);
      }
      return idx.get(key);
    };
    const tri = (a, b, c) => {
      const [ax, ay, az] = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]];
      const u = [pos[b * 3] - ax, pos[b * 3 + 1] - ay, pos[b * 3 + 2] - az];
      const v = [pos[c * 3] - ax, pos[c * 3 + 1] - ay, pos[c * 3 + 2] - az];
      const ny = v[2] * u[0] - v[0] * u[2];
      ind.push(a, ny >= 0 ? b : c, ny >= 0 ? c : b);
    };
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (!inside(x0 + (i + 0.5) * step, z0 + (j + 0.5) * step)) continue;
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1);
      tri(a, b, c); tri(a, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(ind);
    g.computeVertexNormals();
    roofs.push(add(g, ROOF, { flatShading: true }));
  };
  // Apertura con telaio bianco, vetro e montante centrale se larga. face: S (+z), N (-z), W (-x)
  const FRAME = 0xf8f8f8;
  const pane = (face, a0, a1, c, y0, h) => {
    const fr = 0.06, out = face === "S" ? [c + 0.01, c + 0.04, c + 0.04, c + 0.06] : [c - 0.04, c - 0.01, c - 0.06, c - 0.04];
    const parts = [[a0 - fr, a1 + fr, y0 - fr, y0 + h + fr, FRAME, out.slice(0, 2)], [a0, a1, y0, y0 + h, GLASS, out.slice(2)]];
    for (const [lo, hi, ya, yb, color, o] of parts) {
      const extra = [ya, yb, color, color === GLASS ? { transparent: true, opacity: 0.8 } : undefined];
      face === "W" ? box(o[0], o[1], lo, hi, ...extra) : box(lo, hi, o[0], o[1], ...extra);
    }
    if (a1 - a0 > 1) {
      const m = (a0 + a1) / 2, o = out.slice(2);
      face === "W" ? box(o[0], o[1] + 0.02, m - 0.025, m + 0.025, y0, y0 + h, FRAME) : box(m - 0.025, m + 0.025, o[0], o[1] + 0.02, y0, y0 + h, FRAME);
    }
  };
  const win = (x0, x1, z, y0, h) => pane("S", x0, x1, z, y0, h);
  const tree = (x, z, y) => {
    box(x - 0.05, x + 0.05, z - 0.05, z + 0.05, y, y + 1, WOOD);
    const c = add(new THREE.SphereGeometry(0.65, 16, 12), 0x3f8f45);
    c.position.set(x, y + 1.5, z);
  };

  // Impronta comune a piano terra e primo piano
  const P = [[2012.77, -848.8], [2018.95, -848.8], [2018.95, -849.98], [2023, -849.98], [2023, -841.14], [2019.82, -841.14], [2019.82, -842.5], [2015.96, -842.5], [2015.96, -843.65], [2012.77, -843.65]];
  prism(P, 0, H1 - 0.3, WALL);
  prism(P, H1 - 0.3, H1, STONE);
  prism(P, H1, H2, WALL);
  box(2011, 2020, -843.65, -839.2, 0, 0.55, STONE); // basamento portico

  // Terrazzo con parapetto, pilastri e fioriere
  const TER = [[2011.1, -850.3], [2018.95, -850.3], [2018.95, -848.8], [2012.61, -848.8], [2012.61, -843.65], [2019.82, -843.65], [2019.82, -839.4], [2011.1, -839.4]];
  prism(TER, H1 - 0.3, H1, STONE);
  prism(TER, H1, H1 + 0.03, 0xb08a63); // pavimento in doghe
  const par = 0.12, top = H1 + 1;
  box(2011.1, 2011.1 + par, -850.3, -839.4, H1, top, WALL);
  box(2011.1, 2019.82, -839.4 - par, -839.4, H1, top, WALL);
  box(2019.82 - par, 2019.82, -843.65, -839.4, H1, top, WALL);
  box(2011.1, 2018.95, -850.3, -850.3 + par, H1, top, WALL);
  box(2018.95 - par, 2018.95, -850.3, -848.8, H1, top, WALL);
  // coprimuro in pietra sui parapetti
  const cap = (x0, x1, z0, z1) => box(x0 - 0.04, x1 + 0.04, z0 - 0.04, z1 + 0.04, top, top + 0.06, STONE);
  cap(2011.1, 2011.1 + par, -850.3, -839.4); cap(2011.1, 2019.82, -839.4 - par, -839.4);
  cap(2019.82 - par, 2019.82, -843.65, -839.4); cap(2011.1, 2018.95, -850.3, -850.3 + par); cap(2018.95 - par, 2018.95, -850.3, -848.8);
  box(2011.7, 2012.6, -840.2, -839.4, 0.55, H1 - 0.3, WALL);
  box(2018.9, 2019.8, -840.2, -839.4, 0.55, H1 - 0.3, WALL);
  box(2011.2, 2012.5, -840.5, -839.5, H1, top, TERRA);
  box(2018.6, 2019.7, -840.5, -839.5, H1, top, TERRA);
  tree(2011.85, -840, top); tree(2019.15, -840, top);

  // Ingresso nord (prospetto monti): basamento, due pilastri e trave in legno sotto la soletta
  box(2013.3, 2020.5, -852.6, -849.5, 0, 0.5, STONE);
  for (const x of [2014, 2020]) for (const z of [-852.4, -849.7]) box(x - 0.15, x + 0.15, z - 0.15, z + 0.15, 0.5, 3.5, WALL);
  for (let x = 2013.8; x <= 2020.3; x += 0.5) box(x - 0.05, x + 0.05, -852.6, -849.5, 3.5, 3.65, WOOD);
  box(2013.7, 2020.3, -849.6, -849.4, 3.4, 3.65, WOOD);
  // Tettoia sopra le travi: pannello in coppi leggermente inclinato verso nord, con nervature, fascia e grondaia
  const can = new THREE.Group();
  can.position.set(2017.05, 3.8, -851.55);
  can.rotation.x = -0.06;
  group.add(can);
  const cb = (w, h, d, x, y, z, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    can.add(m);
  };
  cb(7.1, 0.08, 2.7, 0, 0, 0, ROOF);
  for (let x = -3.4; x <= 3.41; x += 0.4) cb(0.07, 0.06, 2.7, x, 0.07, 0, 0x7a3a28);
  cb(7.2, 0.16, 0.06, 0, -0.04, -1.38, WOOD);
  cb(7.1, 0.07, 0.1, 0, -0.1, -1.42, 0x8a8a8a);
  // Gradini d'ingresso lato mare e cappello del camino
  box(2011, 2020, -839.2, -838.7, 0, 0.3, STONE);
  box(2011.3, 2019.7, -838.7, -838.3, 0, 0.15, STONE);

  // Tetto e camino
  // Contorno della pianta di copertura (pixel del disegno) convertito in metri locali
  const planXZ = (px, py) => [px / 55.5 + 1999.5, -850.86 + ((py - 217) / 610) * 10.16];
  const ROOF_PLAN = [[692, 272], [1060, 272], [1060, 217], [1348, 217], [1348, 827], [1085, 827], [1085, 765], [875, 765], [875, 705], [692, 714]].map(([px, py]) => planXZ(px, py));
  roofFromPlan(ROOF_PLAN, H2, 0.35, 0.2);
  box(2022.9, 2023.7, -847, -846.2, H2, 9.1, 0xc98a6b);
  box(2022.8, 2023.8, -847.1, -846.1, 9.1, 9.25, STONE);

  // Finestre lato mare (sud nel disegno)
  for (const [a, b, z] of [[2013.4, 2015.5, -843.65], [2017.25, 2019.2, -842.5], [2020.45, 2021.7, -841.14]]) win(a, b, z, 0.55, 2.4);
  for (const [a, b, z] of [[2014.2, 2016.1, -843.65], [2016.5, 2018.3, -842.5], [2021.6, 2022.9, -841.14]]) win(a, b, z, H1 + 0.1, 2.4);

  // Lato monti (nord nel disegno): x ricavata dai pixel del prospetto
  const winN = (x0, x1, z, y0, h) => pane("N", x0, x1, z, y0, h);
  winN(2021.6, 2022.33, -849.98, H1 + 0.1, 2.4);
  winN(2021.65, 2022.95, -849.98, 1.73, 1.56);
  winN(2014.65, 2015.62, -848.8, H1 + 0.1, 2.4);
  winN(2017.7, 2018.3, -848.8, 1.73, 0.57);
  winN(2014.3, 2015.9, -848.8, 0.55, 2.75);

  // Lato massa (ovest nel disegno): porte sulla parete x=2019.82
  const winW = (z0, z1, x, y0, h) => pane("W", z0, z1, x, y0, h);
  winW(-842.45, -841.85, 2019.82, H1 + 0.1, 2.4);
  winW(-842.4, -841.5, 2019.82, 0.55, 2.45);

  // --- Giardino e arredi (coordinate locali del disegno; lotto lx 2007..2027, lz -855..-836.5, cancello sul lato mare) ---
  const put = (geo, color, x, y, z, parent = group, extra) => {
    const m = new THREE.Mesh(geo, mat(color, extra));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cyl = (x, z, y0, rt, rb, h, color, parent) => put(new THREE.CylinderGeometry(rt, rb, h, 10), color, x, y0 + h / 2, z, parent);
  const ball = (x, y, z, r, color, parent, sy = 1) => { const m = put(new THREE.SphereGeometry(r, 12, 10), color, x, y, z, parent); m.scale.y = sy; return m; };
  const palm = (x, z, h, parent = group) => {
    cyl(x, z, 0, 0.12, 0.2, h, 0x8b6b4a, parent);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      g.position.set(x, h, z);
      g.rotation.y = (i / 9) * Math.PI * 2;
      parent.add(g);
      const t = new THREE.Group();
      t.rotation.z = -0.55;
      g.add(t);
      put(new THREE.BoxGeometry(2.4, 0.03, 0.4), 0x3a8a3a, 1.2, 0, 0, t);
    }
    ball(x, h, z, 0.25, 0x6b4a2a, parent);
  };
  const corkTree = (x, z, h, r) => {
    cyl(x, z, 0, 0.12, 0.2, h, 0x6b4a2a);
    ball(x, h + r * 0.5, z, r, 0x3f7f3f, group, 0.85);
    ball(x + r * 0.5, h, z + r * 0.3, r * 0.7, 0x4a8f4a);
    ball(x - r * 0.5, h + 0.2, z - r * 0.3, r * 0.7, 0x356f35);
  };
  const cypress = (x, z, h) => put(new THREE.ConeGeometry(0.55, h, 8), 0x2f6b3a, x, h / 2, z);
  const chair = (x, z, y, dz, parent = group) => {
    box(x - 0.2, x + 0.2, z - 0.2, z + 0.2, y + 0.42, y + 0.47, WOOD);
    box(x - 0.2, x + 0.2, z + dz * 0.2, z + dz * 0.2 + 0.04 * dz, y + 0.47, y + 0.95, WOOD);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + a * 0.18 - 0.02, x + a * 0.18 + 0.02, z + b * 0.18 - 0.02, z + b * 0.18 + 0.02, y, y + 0.42, WOOD);
  };
  const table = (x, z, y, w, d) => {
    box(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + 0.72, y + 0.77, 0xe6d9c3);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + a * (w / 2 - 0.08) - 0.03, x + a * (w / 2 - 0.08) + 0.03, z + b * (d / 2 - 0.08) - 0.03, z + b * (d / 2 - 0.08) + 0.03, y, y + 0.72, WOOD);
  };
  const lounger = (x, z, color, parent, y0 = 0) => {
    const g = parent || group;
    const m = (w, h, d, px, py, pz, c) => put(new THREE.BoxGeometry(w, h, d), c, x + px, y0 + py, z + pz, g);
    m(0.7, 0.08, 1.9, 0, 0.3, 0, color);
    const back = m(0.7, 0.08, 0.8, 0, 0.55, -0.85, color);
    back.rotation.x = -0.6;
    for (const a of [-0.3, 0.3]) for (const b of [-0.8, 0.8]) m(0.05, 0.3, 0.05, a, 0.15, b, 0x777777);
  };
  const parasol = (x, z, color, parent) => {
    const g = parent || group;
    cyl(x, z, 0, 0.04, 0.04, 2.4, 0xdddddd, g);
    put(new THREE.ConeGeometry(1.8, 0.5, 10), color, x, 2.65, z, g);
  };

  // Prato, accesso carrabile e pavimentazione davanti al portico (dalla pianta)
  box(2009.2, 2023.2, -856.7, -834.4, 0, 0.04, 0x84b66a);
  box(2009.2, 2013.6, -856.7, -851.8, 0, 0.06, 0xb9b3a8); // area di manovra dal cancello carrabile
  box(2010, 2023.2, -838.3, -834.4, 0, 0.06, 0xd8cfc0); // pav. a terra davanti al portico e vialetto pedonale
  const car = (x, z, color, rotY, parent) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    (parent || group).add(g);
    put(new THREE.BoxGeometry(4.2, 0.7, 1.8), color, 0, 0.6, 0, g);
    put(new THREE.BoxGeometry(2.2, 0.6, 1.6), 0x8fb8cc, -0.2, 1.2, 0, g);
    for (const a of [-1.3, 1.3]) for (const b of [-0.85, 0.85]) put(new THREE.BoxGeometry(0.6, 0.6, 0.25), 0x222222, a, 0.3, b, g);
  };
  car(2011.6, -854.2, 0x2f4f7a);

  // Recinzioni dai prospetti: pilastri intonacati con copertina in pietra, doghe e cancelli in ferro verniciato.
  // FX = confine su Via Verdi (nord), FZ = confine su Viale Italico (fronte mare)
  const IRON = 0x3d4349, CAP = 0xd9d4c8, FX = 2009.2, FZ = -834.4, HEDGE = 0x2f6b3a;
  const bx = (ax, f, t, a0, a1, y0, y1, c) => (ax === "z" ? box(f - t, f + t, a0, a1, y0, y1, c) : box(a0, a1, f - t, f + t, y0, y1, c));
  const pil = (ax, f, c) => { bx(ax, f, 0.36, c - 0.36, c + 0.36, 0, 1.99, WALL); bx(ax, f, 0.4, c - 0.4, c + 0.4, 1.99, 2.1, CAP); };
  const boards = (ax, f, a0, a1) => {
    for (let k = 0; k < 5; k++) bx(ax, f, 0.04, a0, a1, 0.4 + k * 0.32, 0.67 + k * 0.32, IRON);
    for (let p = a0; p <= a1 + 0.01; p += 1.9) bx(ax, f, 0.06, p - 0.05, p + 0.05, 0.3, 1.97, IRON);
    bx(ax, f, 0.07, a0, a1, 0, 0.14, STONE);
  };
  const gate = (ax, f, a0, a1) => {
    bx(ax, f, 0.05, a0, a1, 0.1, 0.16, IRON);
    bx(ax, f, 0.05, a0, a1, 1.9, 1.97, IRON);
    for (let y = 0.2; y < 1.88; y += 0.13) bx(ax, f, 0.025, a0 + 0.05, a1 - 0.05, y, y + 0.07, IRON);
    const m = (a0 + a1) / 2;
    bx(ax, f, 0.06, m - 0.04, m + 0.04, 0.1, 1.97, IRON);
  };
  // Via Verdi: pilastro d'angolo, cancello carrabile a due ante, pilastro con citofono, doghe
  pil("z", FX, -856.34); gate("z", FX, -855.98, -852.52); pil("z", FX, -852.16);
  box(FX - 0.48, FX - 0.36, -852.41, -851.91, 1, 1.5, 0xcfcfcf);
  boards("z", FX, -851.8, FZ);
  // Viale Italico: doghe, pilastri e cancelletto pedonale vicino a Via Verdi, doghe fino al vicino
  boards("x", FZ, FX, 2010);
  pil("x", FZ, 2010.38); gate("x", FZ, 2010.78, 2011.84); pil("x", FZ, 2012.2);
  boards("x", FZ, 2012.56, 2023.2);
  // Confine est (monti) e sud: siepi
  box(2009.6, 2023.4, -857.4, -856.7, 0, 2, HEDGE);
  box(2022.7, 2023.4, -856.7, -849.98, 0, 2, HEDGE);
  box(2022.7, 2023.4, -841.14, -834.4, 0, 2, HEDGE);

  // Alberi e piante (sughere e oleandro dalla pianta, cipressi lungo la siepe)
  corkTree(2010.4, -849.4, 3, 1.7);
  corkTree(2010.3, -844.6, 3, 1.6);
  ball(2013.2, 0.7, -835.5, 0.6, 0x3f8f45, group, 0.9);
  for (const [dx, dz] of [[-0.3, 0.1], [0.2, -0.2], [0, 0.3]]) ball(2013.2 + dx, 1.2, -835.5 + dz, 0.12, 0xe94b8b);
  for (const x of [2015.5, 2018.5, 2021.5]) cypress(x, -855.8, 4.5);
  // Sotto il portico e sul terrazzo
  table(2015.5, -841.4, 0.55, 2.4, 1.0);
  for (const x of [2014.6, 2015.5, 2016.4]) { chair(x, -840.45, 0.55, 1); chair(x, -842.35, 0.55, -1); }
  box(2011.4, 2013.9, -843.3, -842.5, 0.55, 0.95, 0xb8a890); // divano
  table(2015.4, -841.4, H1 + 0.03, 1.2, 0.8);
  chair(2014.8, -840.7, H1 + 0.03, 1); chair(2016, -840.7, H1 + 0.03, 1);
  lounger(2013.3, -842.4, 0xf4f4f4, group, H1 + 0.03);

  const container = document.getElementById("view3d");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe8f7);
  // Ruota la casa attorno al suo centro: lato mare verso ovest (x negativo), massa a nord, monti a est
  const C = [2018, -846];
  group.rotation.y = -Math.PI / 2;
  group.position.set(C[0] + C[1], 0, C[1] - C[0]);
  scene.add(group);
  // Fotovoltaico (blu scuro) e solare termico (blu chiaro) nelle posizioni della pianta di copertura.
  // Pixel del disegno -> metri locali; ogni modulo viene appoggiato sulla falda reale con un raycast verso il basso.
  {
    group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const inv = group.quaternion.clone().invert();
    const PX = (px) => px / 55.5 + 1999.5, PZ = (py) => -850.86 + ((py - 217) / 610) * 10.16;
    const grids = [
      [849, 295, 975, 406, 2, 1, 0x1f3b5c],
      [1064, 295, 1189, 406, 2, 1, 0x5b8fb0],
      [713, 431, 825, 556, 1, 2, 0x1f3b5c],
      [1128, 541, 1316, 763, 3, 2, 0x1f3b5c],
    ];
    for (const [x0, y0, x1, y1, cols, rows, color] of grids) {
      const w = (PX(x1) - PX(x0)) / cols - 0.12, d = (PZ(y1) - PZ(y0)) / rows - 0.12;
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        const cx = PX(x0) + ((c + 0.5) * (PX(x1) - PX(x0))) / cols;
        const cz = PZ(y0) + ((r + 0.5) * (PZ(y1) - PZ(y0))) / rows;
        ray.set(group.localToWorld(new THREE.Vector3(cx, 30, cz)), down);
        const hit = ray.intersectObjects(roofs, false)[0];
        if (!hit) continue;
        const onRoof = (dx, dz) => {
          ray.set(group.localToWorld(new THREE.Vector3(cx + dx, 30, cz + dz)), down);
          return ray.intersectObjects(roofs, false).length > 0;
        };
        if (![[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]].every(([dx, dz]) => onRoof(dx, dz))) continue;
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).applyQuaternion(inv).normalize();
        if (n.y < 0) n.negate();
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat(color));
        m.position.copy(group.worldToLocal(hit.point.clone())).addScaledVector(n, 0.05);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        group.add(m);
      }
    }
  }
  scene.fog = new THREE.Fog(0xcfe8f7, 500, 4000);
  const plane = (w, h, x, z, y, color, extra) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(color, extra));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  plane(1000, 2400, 2480, -846, 0, 0x8dbb78); // terreno
  plane(25, 2400, 1967.5, -846, 0, 0xe8d9a8); // spiaggia
  plane(2000, 2400, 955, -846, -0.2, 0x2f7fb8); // mare (ovest)
  plane(1.4, 2400, 1954.7, -846, -0.05, 0xffffff, { transparent: true, opacity: 0.55 }); // risacca
  // Viale Italico lungo la costa: marciapiede, aiuola alberata, carreggiata con parcheggi, marciapiede in cotto
  plane(2.5, 2400, 1981.25, -846, 0.05, 0xb9b3a8);
  plane(2.5, 2400, 1983.75, -846, 0.05, 0x7fae6a);
  plane(16, 2400, 1993, -846, 0.03, 0x555a5e);
  plane(5.4, 2400, 2003.7, -846, 0.05, 0xa8584a);
  plane(0.12, 2400, 1992.8, -846, 0.04, 0xe8c547); plane(0.12, 2400, 1993.1, -846, 0.04, 0xe8c547);
  plane(0.12, 2400, 1987.5, -846, 0.04, 0xffffff); plane(0.12, 2400, 1998.5, -846, 0.04, 0xffffff);
  // Via Verdi: perpendicolare alla costa, sul lato nord del lotto, con strisce pedonali all'incrocio
  plane(250, 6, 2126, -860.5, 0.06, 0x555a5e);
  plane(250, 2.6, 2126, -856.2, 0.07, 0xa8584a);
  plane(250, 2.6, 2126, -864.8, 0.07, 0xa8584a);
  for (let x = 2012; x < 2250; x += 6) plane(3, 0.15, x, -860.5, 0.08, 0xffffff);
  for (let z = -863.2; z < -857.6; z += 0.9) plane(3.2, 0.45, 2009.5, z, 0.08, 0xffffff);

  // Elementi vicini (ricevono e proiettano ombre)
  const near = new THREE.Group();
  scene.add(near);
  for (let z = -900; z <= -790; z += 12) {
    if (z > -868 && z < -852) continue;
    cyl(2004.6, z, 0, 0.05, 0.07, 3, 0x333333, near);
    ball(2004.6, 3.1, z, 0.18, 0xfff1b8, near);
  }
  for (let z = -900; z <= -790; z += 24) {
    cyl(1981, z, 0, 0.04, 0.06, 2.6, 0x333333, near);
    ball(1981, 2.7, z, 0.16, 0xfff1b8, near);
  }
  for (let z = -906; z <= -786; z += 18) palm(1983.75, z, 6 + (Math.abs(z) % 3), near);
  [-896, -889, -880, -870, -850, -843, -835, -826, -818, -808].forEach((z, i) => {
    const c = [0xb33a3a, 0xdcdcdc, 0x2f4f7a, 0x1f1f1f, 0xd9c16a][i % 5];
    car(1986.3, z, c, Math.PI / 2, near);
    if (i % 2 === 0) car(2000.2, z + 2, [0xdcdcdc, 0x6b7b8a, 0xb33a3a][(i / 2) % 3], Math.PI / 2, near);
  });
  [[-880, 0xd94a4a], [-868, 0x2f7fb8], [-856, 0xf2c94c], [-836, 0xffffff]].forEach(([z, c], i) => {
    const x = 1963 + (i % 3) * 3.5;
    parasol(x, z, c, near);
    lounger(x - 0.9, z + 1.2, 0xf4f4f4, near);
    lounger(x + 0.9, z + 1.2, 0xf4f4f4, near);
  });
  for (let z = -900; z <= -790; z += 5) ball(1935, 0, z, 0.25, z % 10 ? 0xffffff : 0xe94b3c, near); // boe di delimitazione
  const pyr = new THREE.ConeGeometry(0.7071, 1, 4);
  pyr.rotateY(Math.PI / 4);
  const villa = (x, z, w, d, h, wall, roof, rh = 3) => {
    put(new THREE.BoxGeometry(w, h, d), wall, x, h / 2, z, near);
    const r = put(pyr, roof, x, h + rh / 2, z, near);
    r.scale.set(w + 1.2, rh, d + 1.2);
  };
  villa(2017.6, -836.65, 8, 8.5, 6.5, 0xe9c9b0, 0xa04a38, 1.8); // casa a sud, attaccata
  villa(2017.5, -824, 10, 9, 6.5, 0xf2e8d0, 0xa04a38);
  villa(2016, -873, 10, 9, 6.5, 0xf3e3b8, 0xa04a38);
  villa(2038, -872, 9, 9, 6, 0xdfe8d8, 0xb5543a);
  villa(2038, -847, 12, 10, 7.5, 0xf1e6d2, 0xb5543a); // villa dietro il lotto, lato monti
  villa(2038, -826, 10, 9, 6.5, 0xe8d4a8, 0xa04a38);
  palm(2030, -868, 7, near); palm(2029, -832, 6.5, near); palm(2008, -871, 6.5, near);
  // Barche a vela
  [[1900, -870, 1], [1790, -800, 0.8], [1700, -900, 1.2]].forEach(([x, z, s]) => {
    const b = new THREE.Group();
    b.position.set(x, 0, z);
    b.scale.setScalar(s * 1.4);
    near.add(b);
    put(new THREE.BoxGeometry(6, 0.8, 2), 0xffffff, 0, 0.2, 0, b);
    cyl(0, 0, 0.5, 0.05, 0.05, 7, 0x999999, b);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 6), new THREE.Vector2(2.6, 0)])), mat(0xffffff));
    sail.position.set(0, 1, 0.05);
    b.add(sail);
  });

  // Sfondo: Alpi Apuane a est, nuvole, sole
  const far = new THREE.Group();
  scene.add(far);
  for (let i = 0; i < 18; i++) {
    const s = (k) => Math.abs(Math.sin(i * 12.9898 + k * 78.233));
    const r = 160 + s(1) * 140, h = 150 + s(2) * 220;
    const x = 2450 + (i % 4) * 260 + s(3) * 80, z = -846 + (i - 9) * 200;
    const mt = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), new THREE.MeshLambertMaterial({ color: i % 2 ? 0x6f8a78 : 0x7b8f83 }));
    mt.position.set(x, h / 2, z);
    far.add(mt);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, h * 0.3, 7), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
    cap.position.set(x, h * 0.85, z);
    far.add(cap);
  }
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    c.position.set(1500 + i * 130, 120 + (i % 3) * 25, -1300 + i * 140);
    for (let k = 0; k < 5; k++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(28 + (k % 3) * 8, 10, 8), cloudMat);
      p.position.set(k * 30 - 60, (k % 2) * 6, (k % 3) * 10);
      p.scale.y = 0.45;
      c.add(p);
    }
    far.add(c);
  }
  const sunPos = new THREE.Vector3(1960, 28, -836).sub(new THREE.Vector3(C[0], 0, C[1]));
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
  sunDisc.position.copy(sunPos.clone().normalize().multiplyScalar(1200).add(new THREE.Vector3(C[0], 0, C[1])));
  far.add(sunDisc);

  scene.add(new THREE.HemisphereLight(0xdcefff, 0x9cc78a, 0.75));
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.85);
  sun.position.set(1960, 28, -836);
  sun.target.position.set(C[0], 0, C[1]);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  for (const root of [group, near]) root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  container.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 6000);
  camera.position.set(1972, 15, -818);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(2017, 3, -844);
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.update();

  const resize = () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();
  (function loop() {
    requestAnimationFrame(loop);
    if (!container.hidden) renderer.render(scene, camera);
  })();
})();
