import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript, glScript } from "../../scripts/inline-kit.mjs";
import { glCamera } from "../../kit/gl.mjs";
import * as M from "./model.mjs";
import { plant } from "./plant.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const DEG = Math.PI / 180;

const W = 860;
const H = 560;
const AZIMUTH = 54;
const ELEVATION = 29;

// World: x along the exchanger, y toward the front, z up. About 1 unit per 25 mm.
const PAD = { x: -236, y: -122, w: 368, d: 236, r: 4 };
const PAD_H = 9;
const Y0 = -18; // exchanger axis
const ZC = 60; // exchanger centreline height
const R = 30; // shell outer radius
const RI = 28.6; // shell inner radius
const SX0 = -118; // shell, floating-head end
const SX1 = 62; // shell, channel end
const FL_R = 35.5; // girth flange radius
const FL_T = 4;
const WIN = { s0: -64, s1: 12, a0: -30 * DEG, a1: 98 * DEG };
const BAFFLES = [-50, -22, 6];
const SADDLES = [-84, 30];
const PIER = 10;
const TUBE_R = 2.3;
const PITCH = 6.6;
const BUNDLE_R = 25.4;
const NOZZLE_IN = -98;
const NOZZLE_OUT = 44;
const NOZZLE_R = 5;
const NOZZLE_TOP = ZC + R + 13;

const SHELL = G.frameOf([0, Y0, ZC], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

const P = k.fitProjection(
  [...k.boxCorners(PAD, -PAD_H, 0), [44, -60, 150], [-98, -18, 140], [-118, 40, 136], [44, -98, 140]],
  W,
  H,
  { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const path = (points, closed = false) => k.pathOf(points.map((p) => at(p)), closed);
const FADE = [0.04, 0.42];

const R0 = A.recorder(P, {});
const record = R0.solid;
const nameFor = R0.nameFor;
function put(at3, svg, { bias = 0, shapes = [], name = nameFor("item") } = {}) {
  R0.put({ piece: "rig", at: at3, bias, svg, shapes, name, move: [0, 0, 0] });
}
function tubeItems(route, r, { name, tone = "hi", bias = 0, maxLength = 26, spacing, owner, limp = false, gaps = [], caps = true, rims, rings, free = [false, false], touch } = {}) {
  const id = nameFor(name ?? "tube");
  R0.route(id, route, r, { owner: owner ?? id, limp, gaps, rims, free, touch, piece: "rig", move: [0, 0, 0] });
  tubePieces(route, r, P, { maxLength, spacing, gaps, caps, rings }).forEach((part, index) =>
    put(part.mid, tubeSvg(part, { tone }), { bias, name: `${id}:${index}`, shapes: [A.tube(part.points, part.radii)] }),
  );
  return id;
}

function turned(F, profile, style = {}, { extra = "", inner = "", bias = 0, rims, bevel = 0, steps, name, owner, smooth } = {}) {
  const soft = smooth ?? profile.some((point) => point[2]);
  const paths = G.solidOf(profile, F, P, { bevel, smooth: soft, ...(rims ? { rims } : {}), ...(steps ? { steps } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const id = nameFor(name ?? "turned");
  const shape = record(A.solid(F, profile, { name: id, owner, curve: soft && !(smooth && smooth.slope) ? profile : undefined }));
  put(G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "hi", ...style, inner }) + extra, { bias, name: id, shapes: [shape] });
  return shape;
}

function discAt(F, s0, s1, r, style = {}, { extra = "", inner = "", bias = 0, name, owner, rims, bevel = 0 } = {}) {
  const id = nameFor(name ?? "disc");
  const shape = record(A.disc(F, s0, s1, r, { name: id, owner }));
  put(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P, { bevel, ...(rims ? { rims } : {}) }), { tone: "hi", ...style, inner }) + extra, { bias, name: id, shapes: [shape] });
  return shape;
}

function flangeAt(centre, axis, r, thick, { bolts = 8, tone = "hi", bias = 0, boltR, name, owner, size = 0.42 } = {}) {
  const F = G.frameAlong(centre, axis);
  const id = nameFor(name ?? "flange");
  const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
  const face = Math.abs(G.dot3(F.a, V)) > 0.12 && bolts ? Dots(G.dotsOf(F, towards, boltR ?? r * 0.76, bolts, P, { all: true }), { size, tone: "mid" }) : "";
  const rim = bolts && Math.abs(G.dot3(F.a, V)) < 0.97 ? Ln(G.arcOf(F, 0, r, P), { tone: "faint" }) : "";
  put(centre, S(G.disc(-thick / 2, thick / 2, r, F, P), { tone, inner: rim }) + face, { bias, name: id, shapes: [record(A.disc(F, -thick / 2, thick / 2, r, { name: id, owner }))] });
  return id;
}

function boxAt(plan, z, h, style = {}, { extra = "", bias = 0, bevel = 0.5, steps = 3, name, owner, inner = "" } = {}) {
  const centre = [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
  const id = nameFor(name ?? "box");
  put(centre, S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "hi", ...style, inner }) + extra, { bias, name: id, shapes: [record(A.slab(plan, z, h, { name: id, owner }, steps))] });
  return id;
}

function prismAt(F, polygon, s0, s1, style = {}, { extra = "", bias = 0, name, owner } = {}) {
  const id = nameFor(name ?? "prism");
  const c = polygon.reduce((sum, [x, y]) => [sum[0] + x / polygon.length, sum[1] + y / polygon.length], [0, 0]);
  const centre = G.add3(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), G.add3(G.mul3(F.u, c[0]), G.mul3(F.v, c[1])));
  put(centre, S(G.prismOf(F, polygon, s0, s1, P), { tone: "mid", ...style }) + extra, { bias, name: id, shapes: [record(A.prism(F, polygon, s0, s1, { name: id, owner }))] });
  return id;
}

function ballAt(centre, r, { tone = "mid", bias = 0, name, owner } = {}) {
  const id = nameFor(name ?? "ball");
  put(centre, S(G.sphereOf(centre, r, P, { steps: G.stepsFor(r, 32) }), { tone }), { bias, name: id, shapes: [record(A.ball(centre, r, { name: id, owner }))] });
}

// A plate of any outline (concave too) in a frame's u, v plane, thick along F.a.
function platePaths(F, poly, s0, s1) {
  const L = G.lightOf(P);
  const pt = (s, [x, y]) => G.add3(G.add3(F.o, G.mul3(F.a, s)), G.add3(G.mul3(F.u, x), G.mul3(F.v, y)));
  const area = poly.reduce((sum, [x, y], i) => {
    const [x1, y1] = poly[(i + 1) % poly.length];
    return sum + x * y1 - x1 * y;
  }, 0);
  const ring = area < 0 ? [...poly].reverse() : poly;
  const n = ring.length;
  const faces = [];
  for (let j = 0; j < n; j++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[(j + 1) % n];
    const normal = G.unit3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0))));
    if (G.dot3(normal, V) > 1e-6) faces.push({ pts: [pt(s0, ring[j]), pt(s0, ring[(j + 1) % n]), pt(s1, ring[(j + 1) % n]), pt(s1, ring[j])], tone: G.bandOf(G.dot3(normal, L)) });
  }
  const capS = G.dot3(F.a, V) > 0 ? s1 : s0;
  const capN = G.dot3(F.a, V) > 0 ? F.a : G.mul3(F.a, -1);
  const cap = ring.map((p) => pt(capS, p));
  faces.push({ pts: cap, tone: G.bandOf(G.dot3(capN, L)), cap: true });
  const fills = faces.map(({ pts }) => `<path class="iso-fill" d="${path(pts, true)}"/>`).join("");
  const shades = faces.map(({ pts, tone }) => (tone === 4 ? `<path class="iso-top" d="${path(pts, true)}"/>` : `<path class="iso-shade" data-shade="${tone}" d="${path(pts, true)}"/>`)).join("");
  const edges = faces.map(({ pts }) => path(pts, true)).join("");
  return { fills, shades, edges };
}
function plateSvg(F, poly, s0, s1, tone = "mid") {
  const { fills, shades, edges } = platePaths(F, poly, s0, s1);
  return `<g class="iso-solid">${fills}${shades}<path class="iso-line iso-edge" data-tone="${tone}" d="${edges}"/></g>`;
}

// ---------------------------------------------------------------- pad and piers
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(PAD, -PAD_H, PAD_H, P)}"/>`);
back.push(S(k.slabOf(PAD, -PAD_H, PAD_H, P, 4, 1.4), { tone: "lo" }));
record(A.slab(PAD, -PAD_H, PAD_H, { name: "stand.pad" }, 4));
back.push(Ln(k.planOutline(k.insetPlan(PAD, 6), 0, P, 4), { tone: "faint" }));
// control joints sawn across the pad, edge to edge
const joints = [-110, 10].map((x) => k.lineOnTop([x, PAD.y], [x, PAD.y + PAD.d], 0, P)).join("");
back.push(Ln(joints, { tone: "faint" }));
back.push(Ln([-110, 10].map((x) => k.segment([x, PAD.y + PAD.d, -PAD_H], [x, PAD.y + PAD.d, 0], P)).join(""), { tone: "faint" }));

for (const sx of SADDLES) {
  const plan = { x: sx - 11, y: Y0 - 34, w: 22, d: 68, r: 1.5 };
  boxAt(plan, 0, PIER, { tone: "lo" }, { bevel: 0.8, name: "stand.pier", extra: Ln(k.planOutline(k.insetPlan(plan, 2), PIER, P, 3), { tone: "faint" }) });
}

// ---------------------------------------------------------------- saddles
const shellBottom = (y) => ZC - Math.sqrt(R * R - (y - Y0) ** 2);
for (const sx of SADDLES) {
  const base = { x: sx - 8, y: Y0 - 28, w: 16, d: 56, r: 1 };
  const bolts = [
    [sx - 5, Y0 - 24],
    [sx + 5, Y0 - 24],
    [sx - 5, Y0 + 24],
    [sx + 5, Y0 + 24],
  ];
  boxAt(base, PIER, 2, { tone: "mid" }, { bevel: 0.4, name: "stand.saddle-base" });
  for (const [x, y] of [...bolts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))) {
    const id = nameFor("stand.anchor");
    put([x, y, PIER + 3], S(k.cylinder(x, y, 1.6, PIER + 2, 1.4, P, 6), { tone: "mid" }) + S(k.cylinder(x, y, 0.8, PIER + 3.4, 1.6, P, 12), { tone: "mid" }), { name: id, shapes: [record(A.cylinder(x, y, 1.6, PIER + 2, 3, { name: id }))] });
  }
  // web: one plate whose top follows the shell
  const half = 22;
  const web = [[-half, PIER + 2], [half, PIER + 2]];
  for (let i = 0; i <= 24; i++) {
    const y = half - (2 * half * i) / 24;
    web.push([y, shellBottom(Y0 + y) - ZC + ZC]);
  }
  const WF = G.frameOf([sx, Y0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const id = nameFor("stand.saddle-web");
  put([sx, Y0, PIER + 12], plateSvg(WF, web, -1, 1), { name: id, shapes: [record(A.prism(WF, web, -1, 1, { name: id }))] });
  // ribs either side of the web, under the shell
  for (const y of [-14, 0, 14]) {
    const top = shellBottom(Y0 + y);
    const RF = G.frameOf([sx, Y0 + y, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    for (const side of [-1, 1]) {
      const poly = side < 0 ? [[-7, PIER + 2], [-1, PIER + 2], [-1, top], [-3, top]] : [[1, PIER + 2], [7, PIER + 2], [3, top], [1, top]];
      const rid = nameFor("stand.saddle-rib");
      put([sx + side * 3, Y0 + y, PIER + 8], plateSvg(RF, poly, -0.7, 0.7), { name: rid, shapes: [record(A.prism(RF, poly, -0.7, 0.7, { name: rid }))] });
    }
  }
}

// ---------------------------------------------------------------- shell, heads, flanges
const seam = (F, s, r) => Ln(G.arcOf(F, s, r, P), { tone: "faint" });
const SHELL_BANDS = [
  [SX0, WIN.s0 - 8],
  [WIN.s0 - 8, WIN.s1 + 8],
  [WIN.s1 + 8, SX1],
];

// window geometry ---------------------------------------------------------
const onShell = (s, r, a) => G.pointOf(SHELL, s, r, a);
const arcRun = (s, r, a0, a1, n = 28) => Array.from({ length: n + 1 }, (_, i) => onShell(s, r, a0 + ((a1 - a0) * i) / n));
const lineRun = (a, r, s0, s1, n = 8) => Array.from({ length: n + 1 }, (_, i) => onShell(s0 + ((s1 - s0) * i) / n, r, a));
const windowRing = (r) => [...arcRun(WIN.s0, r, WIN.a0, WIN.a1), ...lineRun(WIN.a1, r, WIN.s0, WIN.s1), ...arcRun(WIN.s1, r, WIN.a1, WIN.a0), ...lineRun(WIN.a0, r, WIN.s1, WIN.s0)];
const WIN_OUT = path(windowRing(R), true);
const WIN_IN = path(windowRing(RI), true);

function windowInterior() {
  const L = G.lightOf(P);
  const parts = [];
  // far inner wall, seen from inside
  const wall = [];
  const step = 5 * DEG;
  for (let a = 0; a < 360 * DEG - 1e-9; a += step) {
    const mid = a + step / 2;
    const inward = G.mul3(G.radialOf(SHELL, mid), -1);
    if (G.dot3(inward, V) <= 0) continue;
    const tone = G.bandOf(G.dot3(inward, L));
    const quad = [onShell(WIN.s0 - 30, RI, a), onShell(WIN.s1 + 30, RI, a), onShell(WIN.s1 + 30, RI, a + step), onShell(WIN.s0 - 30, RI, a + step)];
    wall.push(`<path class="iso-shade" data-shade="${Math.min(3, tone)}" d="${path(quad, true)}"/>`);
  }
  parts.push(`<g class="hx-cavity"><path class="hx-void" d="${WIN_OUT}"/>${wall.join("")}</g>`);

  // tube bundle: triangular pitch inside BUNDLE_R
  const tubes = [];
  for (let row = -6; row <= 6; row++) {
    for (let col = -6; col <= 6; col++) {
      const v = row * PITCH * 0.866;
      const u = col * PITCH + (row % 2 ? PITCH / 2 : 0);
      if (Math.hypot(u, v) <= BUNDLE_R - TUBE_R) tubes.push([u, v]);
    }
  }
  const depthOfTube = ([u, v]) => G.dot3(G.add3(G.mul3(SHELL.u, u), G.mul3(SHELL.v, v)), V);
  tubes.sort((a, b) => depthOfTube(a) - depthOfTube(b));
  const spans = [];
  const edges = [WIN.s0 - 14, ...BAFFLES, WIN.s1 + 14];
  for (let i = 0; i < edges.length - 1; i++) spans.push([edges[i] + (i ? 0.7 : 0), edges[i + 1] - (i < edges.length - 2 ? 0.7 : 0)]);
  const ordered = V[0] > 0 ? spans.map((span, i) => ({ span, i })) : spans.map((span, i) => ({ span, i })).reverse();
  for (const { span, i } of ordered) {
    const group = [];
    for (const [u, v] of tubes) {
      const route = [G.add3(onShell(span[0], 0, 0), G.add3(G.mul3(SHELL.u, u), G.mul3(SHELL.v, v))), G.add3(onShell(span[1], 0, 0), G.add3(G.mul3(SHELL.u, u), G.mul3(SHELL.v, v)))];
      const [piece] = tubePieces(route, TUBE_R, P, { maxLength: 400, caps: [i > 0, i < spans.length - 1] });
      group.push(`<g class="hx-tube">${tubeSvg(piece, { tone: "hi" })}<path class="hx-dep" data-span="${i}" d="${piece.body}"/><path class="hx-dep-edge" data-span="${i}" d="${piece.edges}"/></g>`);
    }
    parts.push(group.join(""));
    // the baffle after this span (nearer the viewer)
    const next = V[0] > 0 ? BAFFLES[i] : BAFFLES[i - 1];
    if (next === undefined) continue;
    const index = BAFFLES.indexOf(next);
    const cut = RI * 0.5; // 25 % segmental cut
    const top = index % 2 === 0;
    const poly = [];
    for (let j = 0; j <= 48; j++) {
      const a = (j / 48) * Math.PI * 2;
      const p = [(RI - 0.4) * Math.cos(a), (RI - 0.4) * Math.sin(a)];
      if (top ? p[1] <= cut : p[1] >= -cut) poly.push(p);
    }
    const hull = G.hullOf(poly);
    const BF = G.frameOf(onShell(next, 0, 0), [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const baffle = G.prismOf(BF, hull, -0.6, 0.6, P);
    parts.push(`<g class="hx-baffle">${S(baffle, { tone: "mid" })}<path class="hx-dep hx-dep-flat" data-span="${index + (V[0] > 0 ? 1 : 0)}" d="${baffle.fill}"/></g>`);
  }
  return parts.join("");
}

function windowLips() {
  const L = G.lightOf(P);
  const out = [];
  const face = (pts, normal) => {
    if (G.dot3(normal, V) <= 0) return;
    const tone = G.bandOf(G.dot3(normal, L));
    out.push(`<path class="iso-fill" d="${path(pts, true)}"/><path class="${tone === 4 ? "iso-top" : "iso-shade"}" data-shade="${tone}" d="${path(pts, true)}"/>`);
  };
  face([...arcRun(WIN.s0, R, WIN.a0, WIN.a1), ...arcRun(WIN.s0, RI, WIN.a1, WIN.a0)], [1, 0, 0]);
  face([...arcRun(WIN.s1, R, WIN.a0, WIN.a1), ...arcRun(WIN.s1, RI, WIN.a1, WIN.a0)], [-1, 0, 0]);
  face([...lineRun(WIN.a0, R, WIN.s0, WIN.s1), ...lineRun(WIN.a0, RI, WIN.s1, WIN.s0)], G.tangentOf(SHELL, WIN.a0));
  face([...lineRun(WIN.a1, R, WIN.s0, WIN.s1), ...lineRun(WIN.a1, RI, WIN.s1, WIN.s0)], G.mul3(G.tangentOf(SHELL, WIN.a1), -1));
  return out.join("") + Ln(WIN_IN, { tone: "mid" }) + Ln(WIN_OUT, { tone: "hi" });
}

SHELL_BANDS.forEach(([s0, s1], index) => {
  const id = nameFor("shell.band");
  const paths = G.disc(s0, s1, R, SHELL, P, { rims: index === 0 ? "first" : index === 2 ? "last" : "none" });
  let extra = "";
  if (index === 1) {
    extra = `<clipPath id="hx-win-out"><path d="${WIN_OUT}"/></clipPath><clipPath id="hx-win-in"><path d="${WIN_IN}"/></clipPath><g clip-path="url(#hx-win-out)"><g clip-path="url(#hx-win-in)" class="hx-inside">${windowInterior()}<path class="hx-haze" data-live="haze" d="${WIN_IN}"/></g></g>${windowLips()}`;
  }
  const welds = [s0 + (index === 0 ? 0 : 0), s1].filter((s) => s !== SX0 && s !== SX1).map((s) => seam(SHELL, s, R)).join("");
  put(onShell((s0 + s1) / 2, 0, 0), S(paths, { tone: "hi", inner: welds }) + extra, { name: id, shapes: [record(A.disc(SHELL, s0, s1, R, { name: id }))] });
});

// girth flanges at the channel end
const fl = (s, name) => discAt(SHELL, s, s + FL_T, FL_R, { tone: "hi" }, { name, extra: V[0] > 0 ? Dots(G.dotsOf(SHELL, s + FL_T, FL_R - 2.4, 28, P, { fade: FADE }), { size: 0.42 }) : "" });
fl(SX1, "shell.girth-flange");
fl(SX1 + FL_T, "channel.flange");
const CH0 = SX1 + 2 * FL_T;
const CH1 = CH0 + 28;
discAt(SHELL, CH0, CH1, R, { tone: "hi" }, { name: "channel.barrel", rims: "none", inner: seam(SHELL, CH0 + 14, R) });
fl(CH1, "channel.flange-out");
// channel cover, bolted, facing the viewer
const COVER0 = CH1 + FL_T;
discAt(SHELL, COVER0, COVER0 + 3.4, FL_R, { tone: "hi" }, {
  name: "channel.cover",
  bevel: 0.6,
  extra:
    Dots(G.dotsOf(SHELL, COVER0 + 3.4, FL_R - 2.4, 28, P, { all: true }), { size: 0.5, tone: "mid" }) +
    Ln(G.circleOf(SHELL, COVER0 + 3.4, FL_R - 5, P), { tone: "faint" }) +
    Ln(G.circleOf(SHELL, COVER0 + 3.4, 6, P), { tone: "faint" }),
});
// lifting lug on the cover
put(onShell(COVER0 + 5, 0, 0), S(G.disc(COVER0 + 3.4, COVER0 + 6.2, 3.2, SHELL, P), { tone: "mid" }) + Ln(G.circleOf(SHELL, COVER0 + 6.2, 1.6, P), { tone: "lo" }), { name: "channel.cover-boss", shapes: [record(A.disc(SHELL, COVER0 + 3.4, COVER0 + 6.2, 3.2, { name: "channel.cover-boss" }))] });

// floating-head end: shell flange, cover flange and dished cover
fl(SX0 - FL_T, "shell.rear-flange");
fl(SX0 - 2 * FL_T, "cover.flange");
const HEAD0 = SX0 - 2 * FL_T;
const HEAD_D = 15;
const headR = (s) => R * Math.sqrt(Math.max(0, 1 - ((HEAD0 - 3 - s) / HEAD_D) ** 2));
const headSlope = (s) => {
  const x = (HEAD0 - 3 - s) / HEAD_D;
  if (x <= 0) return 0;
  if (x >= 0.999) return 50;
  return (R * x) / (HEAD_D * Math.sqrt(1 - x * x));
};
// profile runs with s increasing: from the dome tip to the straight flange
const headProfile = [];
for (let i = 0; i <= 26; i++) {
  const x = Math.cos((i / 26) * (Math.PI / 2));
  const s = HEAD0 - 3 - HEAD_D * x;
  headProfile.push([s, R * Math.sqrt(Math.max(0, 1 - x * x)), i > 0 && i < 26 ? 1 : 0]);
}
headProfile.push([HEAD0, R]);
turned(SHELL, headProfile, { tone: "hi" }, { name: "cover.head", smooth: { slope: headSlope }, inner: seam(SHELL, HEAD0 - 3, R) });

// ---------------------------------------------------------------- shell nozzles
function nozzleUp(x, { blind = false, name }) {
  const F = G.frameOf([x, Y0, ZC], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const repadR = NOZZLE_R + 4;
  const repadTop = R + 1.2;
  const id = nameFor(name);
  put([x, Y0, ZC + R + 0.6], S(G.saddleOf(F, repadR, (a) => G.saddleStart(R, repadR, a), repadTop, P), { tone: "hi" }) + Dots(G.dotsOf(F, repadTop, repadR - 1.4, 10, P, { all: true }).filter((_, i) => i % 2 === 0), { size: 0.35, tone: "lo" }), {
    name: `${id}.repad`,
    shapes: [record(A.disc(F, R - 2.2, repadTop, repadR, { name: `${id}.repad`, seated: true, cut: [A.disc(SHELL, SX0, SX1, R, { name: "shell.band", piece: "rig" })] }))],
  });
  discAt(F, repadTop, NOZZLE_TOP - ZC - 3, NOZZLE_R, { tone: "hi" }, { name: `${id}.neck`, rims: "none" });
  flangeAt([x, Y0, NOZZLE_TOP - 1.5], [0, 0, 1], NOZZLE_R + 4.2, 3, { bolts: 8, name: `${id}.flange` });
  if (blind) flangeAt([x, Y0, NOZZLE_TOP + 1.5], [0, 0, 1], NOZZLE_R + 4.2, 3, { bolts: 8, name: `${id}.blind` });
  return [x, Y0, NOZZLE_TOP];
}
const IN_PORT = nozzleUp(NOZZLE_IN, { name: "shell.inlet" });
const OUT_PORT = nozzleUp(NOZZLE_OUT, { name: "shell.outlet" });

// tube-side nozzle on the channel: isolated with a blind flange for the clean
{
  const x = CH0 + 14;
  const F = G.frameOf([x, Y0, ZC], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const a = NOZZLE_R + 1;
  put([x, Y0, ZC + R + 2], S(G.saddleOf(F, a, (t) => G.saddleStart(R, a, t), R + 9, P), { tone: "hi" }), { name: "channel.nozzle", shapes: [record(A.disc(F, R - 2.6, R + 9, a, { name: "channel.nozzle", seated: true, cut: [A.disc(SHELL, CH0, CH1, R, { name: "channel.barrel", piece: "rig" })] }))] });
  flangeAt([x, Y0, ZC + R + 10.5], [0, 0, 1], a + 4.4, 3, { name: "channel.nozzle-flange" });
  flangeAt([x, Y0, ZC + R + 13.5], [0, 0, 1], a + 4.4, 3, { name: "channel.blind", bolts: 8 });
}

// nameplate on the shell's front, a plate on two standoffs
{
  const s = SX1 - 22;
  const a = 8 * DEG;
  const n = G.radialOf(SHELL, a);
  const c = onShell(s, R + 0.6, a);
  const PF = G.frameOf(c, n, [1, 0, 0], G.cross3(n, [1, 0, 0]));
  const plate = [[-9, -5.5], [9, -5.5], [9, 5.5], [-9, 5.5]];
  const id = nameFor("shell.nameplate");
  const rule = (x0, x1, y) => path([G.add3(G.add3(c, G.mul3(n, 0.5)), G.add3(G.mul3(PF.u, x0), G.mul3(PF.v, y))), G.add3(G.add3(c, G.mul3(n, 0.5)), G.add3(G.mul3(PF.u, x1), G.mul3(PF.v, y)))]);
  const text = Ln(rule(-6.5, 6.5, 2.2) + rule(-6.5, 3, 0) + rule(-6.5, 4.6, -2.2), { tone: "lo", free: true });
  const screws = Dots([[-7.8, 4.3], [7.8, 4.3], [-7.8, -4.3], [7.8, -4.3]].map(([x, y]) => at(G.add3(G.add3(c, G.mul3(n, 0.5)), G.add3(G.mul3(PF.u, x), G.mul3(PF.v, y))))), { size: 0.4 });
  put(c, S(G.prismOf(PF, plate, -0.1, 0.5, P), { tone: "mid" }) + text + screws, { name: id, shapes: [record(A.prism(PF, plate, -0.7, 0.5, { name: id }))] });
}

const LIVE_PARTS = plant({ k, G, A, P, V, at, S, Ln, Dots, path, put, record, nameFor, tubeItems, discAt, flangeAt, boxAt, ballAt, plateSvg, FADE, IN_PORT, OUT_PORT, DEG, KS });

// ---------------------------------------------------------------- assemble
A.settle(R0, P);
R0.items.sort((a, b) => a.key - b.key);
const items = R0.items.map((item) => `<g class="it" data-k="${item.key.toFixed(2)}">${item.svg}</g>`);

const defs = "";

const LABEL = "A shell-and-tube heat exchanger on two saddles, cut open to show its tube bundle and baffles coated in hydrocarbon deposit, connected to a vapor-phase cleaning skid and a knockout drum.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [defs, ...back, ...items] });

const SPAN_EDGES = [WIN.s0 - 14, ...BAFFLES, WIN.s1 + 14];
const SPAN_XI = SPAN_EDGES.slice(1).map((x, i) => ((SPAN_EDGES[i] + x) / 2 - SX0) / (SX1 - SX0));
const DATA = { W, H, camera: glCamera(P), shell: { y: Y0, z: ZC, r: R, ri: RI, x0: SX0, x1: SX1, win: [WIN.s0, WIN.s1, WIN.a0, WIN.a1] }, spans: SPAN_XI, P, tote: LIVE_PARTS.tote, gauge: LIVE_PARTS.gauge, drum: LIVE_PARTS.drum };
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const CSS = readFileSync(join(HERE, "exchanger.css"), "utf8");

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Vapor-phase exchanger clean",
  hint: "Hover to run the clean · keys 1–5",
  readout: "Isolated · fouled",
  keys: [
    { mark: "lit", label: "Tube bundle, the metal being cleaned" },
    { mark: "dim", label: "Hydrocarbon deposit, cleared compartment by compartment" },
    { mark: "dotted", label: "Steam carrying the cleaning chemistry" },
  ],
  caption:
    "A floating-head shell-and-tube exchanger cleaned in place by the vapor-phase method, with its tube side blinded off. Steam from the utility station carries cleaning chemistry, metered from the tote by the skid pump, through the braided hose into the shell. The vapor works through the baffled bundle from the inlet toward the outlet, dissolving the hydrocarbon deposit on the tubes and baffles as it goes. It leaves through the knockout drum, which condenses the recovered oil and water for the closed drain, and its vent passes a carbon canister: nothing is steamed to atmosphere, and the bundle never has to be pulled for hydroblasting. The numbers come from one model: a 1.0 mm hydrocarbon deposit (k 0.35 W/m·K) on an exchanger that transfers 300 W/m²·K when clean, so the bundle starts at 54% of clean duty. LEL is the hydrocarbon vapor left in the shell, which must read zero before anyone opens it. It is an illustration, not a job record.",
  body: `<div class="iso-stage hx-stage" tabindex="0" role="slider" aria-label="Vapor-phase cleaning of a heat exchanger. Hover across the figure or use the arrow keys to run the clean." aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${svg}<canvas class="hx-gl" aria-hidden="true"></canvas></div><div class="hx-steps" role="group" aria-label="Cleaning stages">${["Isolated, fouled", "Steam in", "Vapor-phase clean", "Final sweep", "Gas-free"].map((label, i) => `<button type="button" class="hx-step" data-step="${i}"><span class="hx-num">${i + 1}</span>${label}</button>`).join("")}</div>`,
});
const page = k.pageHtml({ title: "Exchanger clean", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + glScript() + MODEL + LIVE, width: 920 });
const name = THEME === "light" ? "exchanger-cleaning-light.html" : "exchanger-cleaning.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${R0.items.length} items`);
A.auditOrExit(R0, P, { allow: [["stand.saddle-web*", "shell.band*"]] });
