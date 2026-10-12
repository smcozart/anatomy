import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript, glScript } from "../../scripts/inline-kit.mjs";
import { glCamera } from "../../kit/gl.mjs";
import * as M from "./model.mjs";
import { makeKit } from "./helpers.mjs";
import { plant } from "./plant.mjs";
import { converter } from "./converter.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const DEG = Math.PI / 180;

const W = 1360;
const H = 1060;
const AZIMUTH = 48;
const ELEVATION = 26;

// World: z up, about 1 unit per 60 mm. The column stands at the origin.
const PAD = { x: -430, y: -200, w: 628, d: 380, r: 4 };
const PAD_H = 9;
const R = 36; // column shell, outside
const RI = 34.6; // inside
const Z_SKIRT = 8;
const Z_TAN = 58; // bottom tangent line
const Z_TOP = 398; // top tangent line
const HEAD_D = 18;
const FL_R = 41.5;
const FL_T = 3;
const JOINTS = [180, 300];
const TRAY_Z = Array.from({ length: M.TRAYS }, (_, j) => 70 + 20 * j);
const VIEW_A = AZIMUTH * DEG;
const WIN_A = [VIEW_A - 46 * DEG, VIEW_A + 48 * DEG];
const SECTIONS = [
  { piece: "c1", z0: Z_TAN, z1: JOINTS[0] - FL_T, win: [63, 172] },
  { piece: "c2", z0: JOINTS[0] + FL_T, z1: JOINTS[1] - FL_T, win: [187, 292] },
  { piece: "c3", z0: JOINTS[1] + FL_T, z1: Z_TOP, win: [307, 386] },
];
const PIECES = {
  stand: { move: [0, 0, 0], name: "Plant" },
  c1: { move: [0, 0, 0], name: "Bottom section and skirt" },
  c2: { move: [0, 0, 30], name: "Middle section" },
  c3: { move: [0, 0, 60], name: "Top section and head" },
};
const STAGGER = ["c3", "c2", "c1", "stand"];
const SPRING = { stagger: 0.08, stiffness: 40, damping: 12.6, substeps: 4 };

const P = k.fitProjection(
  [...k.boxCorners(PAD, -PAD_H, 0), [0, 0, 478], [-300, -170, 426], [-R, R, Z_TOP + 60 + 20], [R, -R, Z_TOP + 60 + 20]],
  W,
  H,
  { pad: 20, azimuth: AZIMUTH, elevation: ELEVATION },
);
const K = makeKit(P, { pieces: PIECES, order: STAGGER, spring: SPRING });
const { V, KS, at, S, Ln, Dots, path, FADE, R: REC, record, nameFor, piece, put, discAt, flangeAt, boxAt, plateAt } = K;

const COL = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const onCol = (z, r, a) => G.pointOf(COL, z, r, a);
const radial = (a) => [Math.cos(a), Math.sin(a), 0];
const tangent = (a) => [-Math.sin(a), Math.cos(a), 0];

// ---------------------------------------------------------------- pad and foundation
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(PAD, -PAD_H, PAD_H, P)}"/>`);
back.push(S(k.slabOf(PAD, -PAD_H, PAD_H, P, 4, 1.4), { tone: "lo" }));
record(A.slab(PAD, -PAD_H, PAD_H, { name: "stand.pad" }, 4));
back.push(Ln(k.planOutline(k.insetPlan(PAD, 6), 0, P, 4), { tone: "faint" }));
back.push(Ln([-70, 80].map((x) => k.lineOnTop([x, PAD.y], [x, PAD.y + PAD.d], 0, P)).join("") + [-70, 80].map((x) => k.segment([x, PAD.y + PAD.d, -PAD_H], [x, PAD.y + PAD.d, 0], P)).join(""), { tone: "faint" }));

piece("stand");
const OCT = Array.from({ length: 8 }, (_, i) => {
  const a = ((i + 0.5) / 8) * Math.PI * 2;
  return [Math.cos(a) * 52, Math.sin(a) * 52];
});
{
  const id = nameFor("stand.plinth");
  put([0, 0, Z_SKIRT / 2], S(k.extrude(OCT, 0, Z_SKIRT - 1.2, P, { bevel: 0.8 }), { tone: "lo", inner: Ln(k.ringSeam(OCT, 2.4, P), { tone: "faint" }) }), { name: id, shapes: [record(A.extruded(OCT, 0, Z_SKIRT - 1.2, { name: id }))] });
}
// base ring and anchor chairs
piece("c1");
discAt(COL, Z_SKIRT - 1.2, Z_SKIRT, R + 6, { tone: "mid" }, { name: "c1.base-ring" });
for (let i = 0; i < 12; i++) {
  const a = ((i + 0.5) / 12) * Math.PI * 2;
  const facing = G.dot3(radial(a), V);
  if (facing < -0.2) continue;
  const p = onCol(Z_SKIRT, R + 3.4, a);
  const id = nameFor("c1.anchor");
  put([p[0], p[1], Z_SKIRT + 1.2], S(k.cylinder(p[0], p[1], 1.5, Z_SKIRT, 1.1, P, 6), { tone: "mid" }) + S(k.cylinder(p[0], p[1], 0.7, Z_SKIRT + 1.1, 1.6, P, 10), { tone: "mid" }), { name: id, shapes: [record(A.cylinder(p[0], p[1], 1.5, Z_SKIRT, 2.7, { name: id }))] });
}

// ---------------------------------------------------------------- skirt with its access opening
{
  const id = nameFor("c1.skirt");
  const door = { a0: VIEW_A - 14 * DEG, a1: VIEW_A + 14 * DEG, z0: Z_SKIRT + 4, z1: Z_SKIRT + 28 };
  const ring = (z, r) => Array.from({ length: 13 }, (_, i) => onCol(z, r, door.a0 + ((door.a1 - door.a0) * i) / 12));
  const archTop = Array.from({ length: 13 }, (_, i) => {
    const a = door.a1 - ((door.a1 - door.a0) * i) / 12;
    const t = (a - door.a0) / (door.a1 - door.a0);
    return onCol(door.z1 - 6 + 6 * Math.sin(t * Math.PI), R, a);
  });
  const outline = [...ring(door.z0, R), ...archTop];
  const opening = `<path class="cd-void" d="${path(outline, true)}"/>` + Ln(path(outline, true), { tone: "hi" });
  const vents = Array.from({ length: 10 }, (_, i) => VIEW_A - 70 * DEG + i * 15.5 * DEG).filter((a) => Math.abs(a - VIEW_A) > 20 * DEG).map((a) => at(onCol(Z_TAN - 7, R, a)));
  put([0, 0, (Z_SKIRT + Z_TAN) / 2], S(G.disc(Z_SKIRT, Z_TAN, R, COL, P, { rims: "first" }), { tone: "hi", inner: Ln(G.arcOf(COL, Z_SKIRT + 34, R, P), { tone: "faint" }) }) + opening + Dots(vents, { size: 1.1, tone: "hi" }), { name: id, shapes: [record(A.ring(COL, Z_SKIRT, Z_TAN, R - 1, R, { name: id }))] });
}

// ---------------------------------------------------------------- shell sections with cut windows and trays
const arcRun = (z, r, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => onCol(z, r, a0 + ((a1 - a0) * i) / n));
const riseRun = (a, r, z0, z1, n = 6) => Array.from({ length: n + 1 }, (_, i) => onCol(z0 + ((z1 - z0) * i) / n, r, a));
const windowRing = (r, [z0, z1]) => [...arcRun(z0, r, WIN_A[0], WIN_A[1]), ...riseRun(WIN_A[1], r, z0, z1), ...arcRun(z1, r, WIN_A[1], WIN_A[0]), ...riseRun(WIN_A[0], r, z1, z0)];

const DC_D = RI * 0.6; // downcomer chord distance from the axis
const dcDir = (j) => radial(VIEW_A + (j % 2 ? -130 : 130) * DEG);
function trayDeck(j) {
  const dir = dcDir(j);
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const p = [(RI - 0.4) * Math.cos(a), (RI - 0.4) * Math.sin(a)];
    if (p[0] * dir[0] + p[1] * dir[1] <= DC_D) pts.push(p);
  }
  return G.hullOf(pts);
}
function trayParts(j) {
  const z = TRAY_Z[j];
  const dir = dcDir(j);
  const perp = [-dir[1], dir[0], 0];
  const half = Math.sqrt(RI * RI - DC_D * DC_D) - 0.4;
  const PF = G.frameOf([dir[0] * DC_D, dir[1] * DC_D, 0], dir, perp, [0, 0, 1]);
  const plate = (z0, z1) => G.prismOf(PF, [[-half, z0], [half, z0], [half, z1], [-half, z1]], -0.35, 0.35, P);
  const down = plate(z - 13, z - 0.6);
  const deck = trayDeck(j);
  const TF = G.frameOf([0, 0, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const paths = G.prismOf(TF, deck, -0.6, 0.6, P);
  const valves = [];
  for (let x = -RI; x <= RI; x += 4.2)
    for (let y = -RI; y <= RI; y += 4.2) {
      const ox = x + (Math.round(y / 4.2) % 2) * 2.1;
      if (Math.hypot(ox, y) > RI - 3 || ox * dir[0] + y * dir[1] > DC_D - 3) continue;
      valves.push(at([ox, y, z + 0.6]));
    }
  const weir = plate(z + 0.6, z + 3);
  return [
    `<g>${S(down, { tone: "mid" })}<path class="cd-dep cd-dep-flat" data-tray="${j}" d="${down.fill}"/></g>`,
    `<g class="cd-tray">${S(paths, { tone: "hi" })}${Dots(valves, { size: 0.55, tone: "lo" })}<path class="cd-dep" data-tray="${j}" d="${paths.top}"/></g>`,
    `<g>${S(weir, { tone: "mid" })}<path class="cd-dep cd-dep-flat" data-tray="${j}" d="${weir.fill}"/></g>`,
  ];
}
function wallFacets(z0, z1) {
  const L = G.lightOf(P);
  const wall = [];
  const step = 5 * DEG;
  for (let a = 0; a < 360 * DEG - 1e-9; a += step) {
    const inward = G.mul3(radial(a + step / 2), -1);
    if (G.dot3(inward, V) <= 0) continue;
    wall.push(`<path class="iso-shade" data-shade="${Math.min(3, G.bandOf(G.dot3(inward, L)))}" d="${path([onCol(z0, RI, a), onCol(z1, RI, a), onCol(z1, RI, a + step), onCol(z0, RI, a + step)], true)}"/>`);
  }
  return wall.join("");
}
// Looking down into a section through its open top flange, when the column is apart.
function openingView(zTop, id) {
  const clip = G.circleOf(COL, zTop, RI, P);
  const below = TRAY_Z.map((z, j) => ({ z, j })).filter(({ z }) => z < zTop && z > zTop - 40);
  return `<clipPath id="${id}"><path d="${clip}"/></clipPath><g clip-path="url(#${id})"><g class="cd-cavity"><path class="cd-void" d="${clip}"/>${wallFacets(zTop - 40, zTop)}</g>${below.map(({ j }) => trayParts(j).join("")).join("")}</g>`;
}
function windowInterior(sec, index) {
  const out = [];
  out.push(`<g class="cd-cavity"><path class="cd-void" d="${path(windowRing(R, sec.win), true)}"/>${wallFacets(sec.win[0] - 30, sec.win[1] + 30)}</g>`);
  const trays = TRAY_Z.map((z, j) => ({ z, j })).filter(({ z }) => z > sec.z0 - 2 && z < sec.z1 + 2);
  for (const { j } of trays) out.push(trayParts(j).join(""));
  out.push(`<path class="cd-haze" data-live="haze" d="${path(windowRing(RI, sec.win), true)}"/>`);
  return out.join("");
}
function windowLips(sec) {
  const L = G.lightOf(P);
  const out = [];
  const face = (pts, normal) => {
    if (G.dot3(normal, V) <= 0) return;
    const tone = G.bandOf(G.dot3(normal, L));
    out.push(`<path class="iso-fill" d="${path(pts, true)}"/><path class="${tone === 4 ? "iso-top" : "iso-shade"}" data-shade="${tone}" d="${path(pts, true)}"/>`);
  };
  face([...arcRun(sec.win[0], R, WIN_A[0], WIN_A[1]), ...arcRun(sec.win[0], RI, WIN_A[1], WIN_A[0])], [0, 0, 1]);
  face([...arcRun(sec.win[1], R, WIN_A[0], WIN_A[1]), ...arcRun(sec.win[1], RI, WIN_A[1], WIN_A[0])], [0, 0, -1]);
  face([...riseRun(WIN_A[0], R, sec.win[0], sec.win[1]), ...riseRun(WIN_A[0], RI, sec.win[1], sec.win[0])], tangent(WIN_A[0]));
  face([...riseRun(WIN_A[1], R, sec.win[0], sec.win[1]), ...riseRun(WIN_A[1], RI, sec.win[1], sec.win[0])], G.mul3(tangent(WIN_A[1]), -1));
  return out.join("") + Ln(path(windowRing(RI, sec.win), true), { tone: "mid" }) + Ln(path(windowRing(R, sec.win), true), { tone: "hi" });
}

SECTIONS.forEach((sec, index) => {
  piece(sec.piece);
  // split the band at the window edges so pipes and platforms sort against each part
  const cuts = [sec.z0, sec.win[0] - 2, sec.win[1] + 2, sec.z1];
  for (let b = 0; b < 3; b++) {
    const [z0, z1] = [cuts[b], cuts[b + 1]];
    const id = nameFor(`${sec.piece}.shell`);
    const rims = index === 0 && b === 0 ? "none" : "none";
    let extra = "";
    if (b === 1) {
      const out = `cd-w${index}o`;
      const inn = `cd-w${index}i`;
      extra = `<clipPath id="${out}"><path d="${path(windowRing(R, sec.win), true)}"/></clipPath><clipPath id="${inn}"><path d="${path(windowRing(RI, sec.win), true)}"/></clipPath><g clip-path="url(#${out})"><g clip-path="url(#${inn})">${windowInterior(sec, index)}</g></g>${windowLips(sec)}`;
    }
    const seams = b === 0 && index === 0 ? Ln(G.arcOf(COL, Z_TAN, R, P), { tone: "faint" }) : "";
    put([0, 0, (z0 + z1) / 2], S(G.disc(z0, z1, R, COL, P, { rims }), { tone: "hi", inner: seams }) + extra, { name: id, shapes: [record(A.disc(COL, z0, z1, R, { name: id }))] });
  }
});
// body flanges at the two section joints: each section keeps its own
JOINTS.forEach((z, i) => {
  for (const [p, s0, top] of [[SECTIONS[i].piece, z - FL_T, true], [SECTIONS[i + 1].piece, z, false]]) {
    piece(p);
    const id = nameFor(`${p}.body-flange`);
    const ring = S(G.ringBand(s0, s0 + FL_T, RI, FL_R, COL, P), { tone: "hi" });
    const inside = top ? openingView(s0 + FL_T, `cd-open${i}`) + Ln(G.circleOf(COL, s0 + FL_T, RI, P), { tone: "mid" }) : "";
    put([0, 0, s0 + FL_T / 2], ring + inside + Dots(G.dotsOf(COL, s0 + FL_T, FL_R - 2.4, 40, P, { all: top, fade: top ? null : FADE }), { size: 0.42 }), { name: id, shapes: [record(A.ring(COL, s0, s0 + FL_T, RI, FL_R, { name: id }))] });
  }
});
// top head
piece("c3");
{
  const headR = (s) => R * Math.sqrt(Math.max(0, 1 - ((s - Z_TOP) / HEAD_D) ** 2));
  const headSlope = (s) => {
    const x = (s - Z_TOP) / HEAD_D;
    if (x <= 0) return 0;
    if (x >= 0.999) return -60;
    return (-R * x) / (HEAD_D * Math.sqrt(1 - x * x));
  };
  const profile = [];
  for (let i = 0; i <= 26; i++) {
    const s = Z_TOP + HEAD_D * Math.sin((i / 26) * (Math.PI / 2));
    profile.push([s, headR(s), i > 0 && i < 26 ? 1 : 0]);
  }
  profile[profile.length - 1][1] = 0.0001;
  K.turned(COL, profile, { tone: "hi" }, { name: "c3.head", smooth: { slope: headSlope, radius: headR }, inner: Ln(G.arcOf(COL, Z_TOP, R, P), { tone: "faint" }) });
}

const PLANT_CTX = { ...K, M, R, RI, COL, onCol, radial, tangent, VIEW_A, WIN_A, Z_TOP, HEAD_D, Z_TAN, Z_SKIRT, JOINTS, FL_R, FL_T, TRAY_Z, SECTIONS, PAD, DEG };
const LIVE_PARTS = plant(PLANT_CTX);
const CONV = converter(PLANT_CTX, LIVE_PARTS);
const COVERS = Object.fromEntries([...LIVE_PARTS.covers.map((v, i) => [String(i), v]), ...CONV.covers.map((v, i) => [`x${i}`, v])]);

// ---------------------------------------------------------------- assemble
A.settle(REC, P);
REC.items.sort((a, b) => a.key - b.key);
const items = REC.items.map((item, i) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${i}">${item.svg}</g>`;
});

const CAPTION =
  "A fluid catalytic cracking unit taken down for turnaround and decontaminated in place by the vapor-phase method. While it runs, catalyst circulates between the reactor and the regenerator, whose fluidized bed burns off coke at about 690 °C. At shutdown the feed comes out, the bed cools and the catalyst is withdrawn. The cleaning skid then puts steam and chemistry in at the riser: the vapor works through the reactor and its cyclones, along the vapor line and up the main fractionator tray by tray, and leaves by the overhead to the air-cooled condenser and reflux drum, a closed loop with nothing steamed to atmosphere. The gas board tests the column against entry limits (0% LEL, H₂S under 1 ppm, benzene under 0.5 ppm), and when all three pass the manways open. The scoreboard compares the decon clock with a conventional steam-out, water wash and re-test. Deposit, gas readings and hours come from one illustrative model, not a job record; the gap between the two clocks is sized to the 104 hours RTI reported saving on one coking-unit shutdown.";
const LABEL = "A fluid catalytic cracking unit: a regenerator cut open to show its catalyst bed and cyclones, a reactor on its structure cut open to show its riser termination and cyclones, the riser, the two catalyst standpipes with slide valves, the air blower and flue-gas stack, and the vapor line to a main fractionator cut open in three flanged sections to show sixteen valve trays, with its overhead to an air-cooled condenser, a reflux drum and pump, a vapor-phase cleaning skid at the riser and a gas board.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [...back, `<g class="cd-items">${items.join("")}</g>`] });
const unit = (v) => {
  const o = at([0, 0, 0]);
  const p = at(v);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  W,
  H,
  P,
  camera: glCamera(P),
  V,
  col: { r: R, ri: RI, win: SECTIONS.map((s) => s.win), a: WIN_A, z0: Z_TAN, z1: Z_TOP },
  trays: M.TRAYS,
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, p]) => [id, p.move.map((v) => v)])),
  screenMove: Object.fromEntries(Object.entries(PIECES).map(([id, p]) => [id, unit(p.move)])),
  stagger: STAGGER,
  spring: SPRING,
  ...LIVE_PARTS,
  convA: [VIEW_A - 44 * DEG, VIEW_A + 44 * DEG],
  board: { rti: M.DECON_HOURS, conventional: M.CONVENTIONAL_HOURS },
  covers: COVERS,
  bed: CONV.bed,
  regenWin: CONV.regenWin,
  rxWin: CONV.rxWin,
};
const trayCss = Array.from({ length: M.TRAYS }, (_, j) => `.cd-dep[data-tray="${j}"]{fill-opacity:calc(var(--t${j},1)*.86)}`).join("");
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const CSS = readFileSync(join(HERE, "column.css"), "utf8") + trayCss;

const stage = `<div class="iso-stage cd-stage" tabindex="0" role="slider" aria-label="Vapor-phase decontamination of a distillation column. Hover across the figure, use the stage buttons or the arrow keys to run it; press A to take the column apart." aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${svg}<canvas class="cd-gl" aria-hidden="true"></canvas></div>`;
const controls = `<div class="cd-controls"><div class="cd-steps" role="group" aria-label="Turnaround stages">${M.STEPS.map((label, i) => `<button type="button" class="cd-step" data-step="${i}"><span class="cd-num">${i + 1}</span>${label}</button>`).join("")}</div><button type="button" class="cd-apart" data-apart aria-pressed="false">Take the column apart</button></div>`;
const body = k.plateHtml({
  fig: "Fig 3",
  title: "FCC unit · turnaround decon",
  hint: "Hover to run the turnaround · A to take the column apart",
  readout: "Shut down · fouled",
  keys: [
    { mark: "lit", label: "Trays and downcomers, the metal being cleaned" },
    { mark: "dim", label: "Hydrocarbon and sulfide deposit, cleared tray by tray from the bottom up" },
    { mark: "dotted", label: "Steam carrying the cleaning chemistry" },
  ],
  caption: CAPTION,
  body: stage + controls + `<div class="fc-board" aria-live="polite"><div class="fc-row"><span class="fc-label">Vapor-phase decon</span><span class="fc-track"><span class="fc-bar fc-rti" data-board="rti-bar"></span><span class="fc-end" style="left:${((100 * M.DECON_HOURS) / M.CONVENTIONAL_HOURS).toFixed(2)}%"></span></span><span class="fc-time" data-board="rti-time">not started</span></div><div class="fc-row"><span class="fc-label">Conventional steam-out</span><span class="fc-track"><span class="fc-bar fc-conv" data-board="conv-bar"></span><span class="fc-end" style="left:100%"></span></span><span class="fc-time" data-board="conv-time">not started</span></div><div class="fc-saved" data-board="saved"></div></div>`,
});
const page = k.pageHtml({ title: "FCC unit decon", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + glScript() + MODEL + LIVE, width: 1420 });
const name = THEME === "light" ? "fcc-unit-light.html" : "fcc-unit.html";
writeFileSync(join(HERE, name), page);


console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${REC.items.length} items`);
A.auditOrExit(REC, P, { allow: [["stand.suction.flange", "stand.suction:0"]] });
