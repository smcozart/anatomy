// Everything around the exchanger: the cleaning skid, the steam hose, the vapor line,
// the knockout drum and the carbon canister. `ctx` carries the build's helpers.
export function plant(ctx) {
  const { k, G, A, P, V, at, S, Ln, Dots, path, put, record, nameFor, tubeItems, discAt, flangeAt, boxAt, ballAt, plateSvg, FADE, IN_PORT, OUT_PORT, DEG, KS } = ctx;
  const live = {};

  // ------------------------------------------------------------ pipe helper
  const alongAt = (line, test) => {
    const total = G.pathLength(line);
    let best = 0;
    let score = Infinity;
    for (let a = 0; a <= total; a += 0.25) {
      const v = test(G.pointAlong(line, a));
      if (v < score) {
        score = v;
        best = a;
      }
    }
    return best;
  };
  function pipe(control, r, { bend = 2.6, tone = "hi", flanges = [true, true], flangeR = 1.6, bands = [], maxLength = 22, name, gaps: extra = [], rings, caps, touch, valveAt } = {}) {
    const line = G.fillet(control, Math.max(r * bend, 3), r > 3 ? 18 : 12, { P, tube: r });
    const total = G.pathLength(line);
    if (valveAt) {
      const v = alongAt(line, valveAt);
      line.valve = v;
      extra = [...extra, [v - r * 2.1, v + r * 2.1]];
    }
    const collars = [];
    [[0, -1], [total, 1]].forEach(([along, sign], index) => {
      if (!flanges[index]) return;
      const thick = Math.max(1.2, r * 0.55);
      const tangent = G.tangentAlong(line, along);
      collars.push({ kind: "flange", centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: r * [flangeR].flat()[Math.min(index, [flangeR].flat().length - 1)], thick, gap: sign < 0 ? [0, thick] : [total - thick, total] });
    });
    for (const share of bands) {
      const along = share > 1 ? share : total * share;
      const thick = Math.max(0.9, r * 0.6);
      collars.push({ kind: "band", centre: G.pointAlong(line, along), tangent: G.tangentAlong(line, along), radius: r * 1.22, thick, gap: [along - thick / 2, along + thick / 2] });
    }
    const gaps = [...collars.map(({ gap }) => gap), ...extra];
    const owner = tubeItems(line, r, { name: name ?? "pipe", tone, maxLength, spacing: Math.max(0.8, Math.min(2.4, r * 0.18)), gaps, rings, caps, touch, rims: flanges.map((on, i) => (on ? r * [flangeR].flat()[Math.min(i, [flangeR].flat().length - 1)] : r)) });
    for (const { kind, centre, tangent, radius, thick } of collars) flangeAt(centre, tangent, radius, thick, { bolts: kind === "flange" && r > 2.5 ? 8 : 0, tone: kind === "flange" ? tone : "mid", name: `${owner}.${kind}`, owner });
    line.owner = owner;
    line.total = total;
    return line;
  }

  // A gate valve on a horizontal run with a handwheel on its bonnet.
  function gateValve(line, along, r, { name } = {}) {
    const centre = G.pointAlong(line, along);
    const tangent = G.tangentAlong(line, along);
    const F = G.frameAlong(centre, tangent);
    const id = nameFor(name ?? `${line.owner}.valve`);
    const half = r * 2.1;
    const crown = r * 1.85;
    const bulge = (x) => r * 1.4 + (crown - r * 1.4) * Math.sqrt(Math.max(0, 1 - (x / (r * 1.5)) ** 2));
    const bulgeSlope = (x) => {
      if (Math.abs(x) >= r * 1.5 - 1e-9) return 0;
      const t = Math.max(-0.995, Math.min(0.995, x / (r * 1.5)));
      return (-(crown - r * 1.4) * t) / (r * 1.5 * Math.sqrt(1 - t * t));
    };
    const meridian = [[-half, 0], [-half, r * 1.55], [-r * 1.5, r * 1.55], ...Array.from({ length: 15 }, (_, i) => {
      const x = r * 1.5 * Math.sin(((i - 7) / 7) * (Math.PI / 2));
      return [x, bulge(x), i && i < 14 ? 1 : 0];
    }), [r * 1.5, r * 1.55], [half, r * 1.55], [half, 0]];
    const faces = [-half, half].filter((s) => Math.abs(G.dot3(F.a, V)) > 0.12).map((s) => Dots(G.dotsOf(F, s, r * 1.22, 6, P, { all: true }), { size: 0.38, tone: "mid" })).join("");
    put(centre, S(G.lathe(meridian, F, P, { steps: 36, smooth: { slope: bulgeSlope, rows: 3 } }), { tone: "hi" }) + faces, { name: id, shapes: [record(A.body(F, meridian, { name: id, owner: line.owner }))] });
    const UF = G.frameOf(centre, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const bonnet0 = crown - 0.3;
    const bonnet1 = crown + r * 1.6;
    put(G.add3(centre, [0, 0, (bonnet0 + bonnet1) / 2]), S(G.disc(bonnet0, bonnet1, r * 0.75, UF, P), { tone: "hi" }) + Ln(G.arcOf(UF, bonnet0 + r * 0.5, r * 0.75, P), { tone: "faint" }), { bias: 0.2, name: `${id}.bonnet`, shapes: [record(A.disc(UF, bonnet0, bonnet1, r * 0.75, { name: `${id}.bonnet`, owner: line.owner }))] });
    const stem1 = bonnet1 + r * 1.2;
    put(G.add3(centre, [0, 0, (bonnet1 + stem1) / 2]), S(G.disc(bonnet1, stem1, 0.55, UF, P), { tone: "mid" }), { bias: 0.25, name: `${id}.stem`, shapes: [record(A.disc(UF, bonnet1, stem1, 0.55, { name: `${id}.stem`, owner: line.owner }))] });
    const wheelR = r * 1.9;
    const w0 = stem1 - 0.4;
    const w1 = stem1 + 0.5;
    put(G.add3(centre, [0, 0, stem1]), Ln(G.spokesOf(UF, w1 - 0.2, 0.4, wheelR - 0.45, 3, P), { tone: "mid" }) + S(G.ringBand(w0, w1, wheelR - 0.9, wheelR, UF, P), { tone: "mid" }) + S(G.disc(w0, w1 + 0.2, 1.1, UF, P), { tone: "mid" }), {
      bias: 0.3,
      name: `${id}.wheel`,
      shapes: [record(A.ring(UF, w0, w1, wheelR - 0.9, wheelR, { name: `${id}.wheel`, owner: line.owner })), record(A.disc(UF, w0, w1 + 0.2, 1.1, { name: `${id}.hub`, owner: line.owner })), ...[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        const d = [Math.cos(a), Math.sin(a), 0];
        const mid = (wheelR - 0.9 + 1.1) / 2;
        return record(A.orientedBox(G.add3(centre, [d[0] * mid, d[1] * mid, (w0 + w1) / 2]), [d, [-d[1], d[0], 0], [0, 0, 1]], [(wheelR - 0.9 - 1.1) / 2 + 0.2, 0.3, (w1 - w0) / 2], { name: `${id}.spoke`, owner: line.owner }));
      })],
    });
    return id;
  }

  // ------------------------------------------------------------ cleaning skid
  const SKID = { x: -218, y: 30, w: 104, d: 80, r: 2 };
  const SKID_H = 5;
  boxAt(SKID, 0, SKID_H, { tone: "mid" }, {
    name: "skid.base",
    bevel: 0.8,
    inner: Ln(k.sideSeam(SKID, 2.2, P, 3), { tone: "faint" }),
    extra: Ln(k.planOutline(k.insetPlan(SKID, 3), SKID_H, P, 3), { tone: "lo" }) + Dots(k.dotGrid(SKID.x + 46, SKID.y + 6, 15, 10, 3.4, SKID_H, P), { size: 0.32, tone: "lo" }) + Dots(k.corners(SKID, 1.6).map(([x, y]) => at([x, y, SKID_H])), { size: 0.45 }),
  });
  // fork pockets on the front face
  for (const x0 of [SKID.x + 18, SKID.x + SKID.w - 34]) {
    const y = SKID.y + SKID.d;
    const pocket = [[x0, y + 0.05, 1], [x0 + 16, y + 0.05, 1], [x0 + 16, y + 0.05, 3.6], [x0, y + 0.05, 3.6]];
    put([x0 + 8, y, 2.4], `<path class="hx-pocket" d="${path(pocket, true)}"/>` + Ln(path(pocket, true), { tone: "lo" }), { bias: 0.05, name: nameFor("skid.pocket"), shapes: [record(A.box([x0, y - 0.1, 1], [x0 + 16, y + 0.1, 3.6], { name: "skid.pocket" }))] });
  }
  // lifting padeyes at the four corners
  for (const [x, y] of k.corners(SKID, 3.4).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))) {
    const F = G.frameOf([x, y, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const poly = [[-2.4, SKID_H], [2.4, SKID_H], [2.4, SKID_H + 3], [1.2, SKID_H + 4.6], [-1.2, SKID_H + 4.6], [-2.4, SKID_H + 3]];
    const id = nameFor("skid.padeye");
    put([x, y, SKID_H + 2], plateSvg(F, poly, -0.6, 0.6) + Ln(G.circleOf(G.frameOf([x + 0.6, y, SKID_H + 3], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 0, 1, P), { tone: "lo" }), { name: id, shapes: [record(A.prism(F, poly, -0.6, 0.6, { name: id }))] });
  }

  // chemical tote: pallet, translucent tank, tubular cage
  const TOTE = { x: -212, y: 36, w: 38, d: 38, r: 1 };
  const PALLET_H = 4;
  const TANK = { ...k.insetPlan(TOTE, 2.4), r: 4 };
  const TANK_Z = SKID_H + PALLET_H;
  const TANK_H = 31;
  const CAGE_TOP = TANK_Z + TANK_H + 1.4;
  boxAt(TOTE, SKID_H, PALLET_H, { tone: "lo" }, { name: "skid.tote-pallet", bevel: 0.5, inner: Ln(k.sideSeam(TOTE, SKID_H + 1.6, P, 3), { tone: "faint" }) });
  {
    const id = nameFor("skid.tote");
    const tank = k.slabOf(TANK, TANK_Z, TANK_H, P, 6, 0.8);
    const cap = k.cylinder(TANK.x + TANK.w / 2, TANK.y + TANK.d / 2, 4.4, TANK_Z + TANK_H, 2.6, P, 24, 0.4);
    // cage: verticals on the two faces we see, rails at four heights, a top frame
    const bars = [];
    const xs = [];
    for (let x = TOTE.x + 1; x <= TOTE.x + TOTE.w - 1 + 1e-6; x += (TOTE.w - 2) / 5) xs.push(x);
    const ys = [];
    for (let y = TOTE.y + 1; y <= TOTE.y + TOTE.d - 1 + 1e-6; y += (TOTE.d - 2) / 5) ys.push(y);
    const front = TOTE.y + TOTE.d - 1;
    const side = TOTE.x + TOTE.w - 1;
    for (const x of xs) bars.push(k.segment([x, front, TANK_Z], [x, front, CAGE_TOP], P));
    for (const y of ys) bars.push(k.segment([side, y, TANK_Z], [side, y, CAGE_TOP], P));
    const rails = [TANK_Z + 8, TANK_Z + 16, TANK_Z + 24, CAGE_TOP].map((z) => path([[TOTE.x + 1, front, z], [side, front, z], [side, TOTE.y + 1, z]]));
    const topFrame = path([[TOTE.x + 1, TOTE.y + 1, CAGE_TOP], [TOTE.x + 1, front, CAGE_TOP]]) + path([[TOTE.x + 1, TOTE.y + 1, CAGE_TOP], [side, TOTE.y + 1, CAGE_TOP]]);
    const level = `<path class="hx-tote-liquid" data-live="tote-liquid" d=""/><path class="iso-line hx-tote-level" data-tone="mid" data-live="tote-level" d=""/>`;
    const label = `<path class="hx-tote-label" d="${path([[TANK.x + 6, TANK.y + TANK.d + 0.05, TANK_Z + 19], [TANK.x + 20, TANK.y + TANK.d + 0.05, TANK_Z + 19], [TANK.x + 20, TANK.y + TANK.d + 0.05, TANK_Z + 27], [TANK.x + 6, TANK.y + TANK.d + 0.05, TANK_Z + 27]], true)}"/>`;
    put([TOTE.x + TOTE.w / 2, TOTE.y + TOTE.d / 2, TANK_Z + 16], `<g class="hx-tote">${S(tank, { tone: "mid" })}${level}${label}${S(cap, { tone: "mid" })}${Ln(k.knurl(TANK.x + TANK.w / 2, TANK.y + TANK.d / 2, 4.4, TANK_Z + TANK_H, TANK_Z + TANK_H + 2.6, 24, P), { tone: "lo" })}${Ln(bars.join("") + rails.join("") + topFrame, { tone: "mid" })}</g>`, {
      name: id,
      shapes: [record(A.slab(TOTE, TANK_Z, CAGE_TOP - TANK_Z, { name: id }, 3))],
    });
    live.tote = { plan: k.insetPlan(TANK, 0.6), outer: TANK, z: TANK_Z + 0.6, h: TANK_H - 1.2, steps: 6 };
  }
  // tote outlet valve on the front face, low
  const TOTE_OUT = [TOTE.x + 30, TOTE.y + TOTE.d, TANK_Z + 3.4];

  // metering pump: base, motor with fins, coupling guard, pump head
  const PUMP = { x: -166, y: 40, w: 40, d: 22, r: 1 };
  boxAt(PUMP, SKID_H, 2, { tone: "mid" }, { name: "skid.pump-base", bevel: 0.4, extra: Dots(k.corners(PUMP, 2).map(([x, y]) => at([x, y, SKID_H + 2])), { size: 0.45 }) });
  const PZ = SKID_H + 2 + 7.5;
  const PY = PUMP.y + PUMP.d / 2;
  const MF = G.frameOf([0, PY, PZ], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  // motor feet
  for (const x of [-156, -148]) boxAt({ x: x - 2, y: PY - 5, w: 4, d: 10, r: 0.5 }, SKID_H + 2, PZ - 6 - SKID_H - 2, { tone: "mid" }, { name: "skid.motor-foot", bevel: 0.2 });
  {
    const id = nameFor("skid.motor");
    const ribs = G.ribsOf(MF, -158, -146, 6, 20, P, { fade: [0.1, 0.55], seams: true });
    put([-152, PY, PZ], S(G.disc(-158, -146, 6, MF, P), { tone: "hi" }) + k.fadedSvg(ribs, { tone: "lo" }), { name: id, shapes: [record(A.disc(MF, -158, -146, 6, { name: id }))] });
    discAt(MF, -162, -158, 5.4, { tone: "mid" }, { name: "skid.motor-fan", extra: Dots(G.dotsOf(MF, -162, 3.6, 12, P, { fade: FADE }), { size: 0.35, tone: "lo" }) });
    boxAt({ x: -155, y: PY - 3, w: 6, d: 6, r: 0.4 }, PZ + 5.8, 4, { tone: "mid" }, { name: "skid.motor-box", bevel: 0.3, extra: Dots([at([-154, PY - 2, PZ + 9.8]), at([-150, PY + 2, PZ + 9.8])], { size: 0.4 }) });
    discAt(MF, -146, -140, 3.4, { tone: "mid" }, { name: "skid.coupling-guard" });
    discAt(MF, -140, -137, 6.6, { tone: "hi" }, { name: "skid.pump-flange", extra: Dots(G.dotsOf(MF, -137, 5.4, 8, P, { all: true }), { size: 0.38 }) });
    const head = [[-137, 6], [-133, 6], [-131.5, 5.2, 1], [-130.5, 3.8, 1], [-130, 2.2]];
    put([-133, PY, PZ], S(G.solidOf(head, MF, P, { smooth: true }), { tone: "hi" }), { name: "skid.pump-head", shapes: [record(A.solid(MF, head, { name: "skid.pump-head", curve: head }))] });
  }
  const PUMP_TOP = [-134.4, PY, PZ + 5.93];

  // suction line, tote valve to pump
  const suction = pipe([TOTE_OUT, [TOTE_OUT[0], TOTE_OUT[1] + 5, TOTE_OUT[2]], [-122, TOTE_OUT[1] + 5, TOTE_OUT[2]], [-122, PY, TOTE_OUT[2]], [-122, PY, PZ], [-130, PY, PZ]], 1.1, { name: "skid.suction", bend: 3, flangeR: 2, tone: "mid" });
  void suction;

  // ------------------------------------------------------------ steam manifold
  const MY = 98;
  const MZ = 30;
  const MAN_R = 3.2;
  const RISER = [-228, MY];
  boxAt({ x: RISER[0] - 7, y: RISER[1] - 7, w: 14, d: 14, r: 1 }, 0, 2.4, { tone: "lo" }, { name: "stand.steam-plinth", bevel: 0.4, extra: Dots(k.corners({ x: RISER[0] - 7, y: RISER[1] - 7, w: 14, d: 14 }, 2).map(([x, y]) => at([x, y, 2.4])), { size: 0.45 }) });
  const HOSE_X = -118;
  const HOSE_Z = 52;
  const manifold = pipe([[RISER[0], RISER[1], 2.4], [RISER[0], RISER[1], MZ], [HOSE_X, MY, MZ], [HOSE_X, MY, HOSE_Z]], MAN_R, { name: "skid.manifold", flangeR: 1.7, touch: ["skid.stand*", "skid.gauge*", "skid.quill*"], valveAt: (p) => Math.abs(p[0] + 210) + Math.abs(p[2] - MZ) * 10 });
  gateValve(manifold, manifold.valve, MAN_R, { name: "skid.steam-valve" });
  // pipe stands under the manifold
  for (const x of [-190, -134]) {
    const plan = { x: x - 3, y: MY - 3, w: 6, d: 6, r: 0.6 };
    const top = MZ - MAN_R;
    const onSkid = x > SKID.x && MY < SKID.y + SKID.d;
    const z0 = onSkid ? SKID_H : 0;
    boxAt({ x: x - 5, y: MY - 5, w: 10, d: 10, r: 0.8 }, z0, 1.2, { tone: "mid" }, { name: "skid.stand-base", bevel: 0.2 });
    boxAt(plan, z0 + 1.2, top - z0 - 1.2 - 1.4, { tone: "mid" }, { name: "skid.stand" });
    boxAt({ x: x - 4, y: MY - 4, w: 8, d: 8, r: 0.6 }, top - 1.4, 1.4, { tone: "mid" }, { name: "skid.stand-shoe", bevel: 0.2 });
  }

  // pressure gauge on a short stem above the run, its face toward the viewer
  const GAUGE_X = -172;
  {
    const stem = [GAUGE_X, MY, MZ + MAN_R];
    const UF = G.frameOf([GAUGE_X, MY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const id = nameFor("skid.gauge");
    put([GAUGE_X, MY, MZ + MAN_R + 2], S(G.saddleOf(UF, 1.4, (a) => MZ + Math.sqrt(Math.max(0, MAN_R * MAN_R - (1.4 * Math.cos(a)) ** 2)), MZ + MAN_R + 1, P), { tone: "mid" }), { name: `${id}.boss`, shapes: [record(A.disc(UF, MZ + MAN_R - 0.4, MZ + MAN_R + 1, 1.4, { name: `${id}.boss`, seated: true, cut: [A.tube([[RISER[0], MY, MZ], [HOSE_X, MY, MZ]], MAN_R, { name: "skid.manifold", piece: "rig" })] }))] });
    discAt(UF, MZ + MAN_R + 1, MZ + MAN_R + 6, 0.8, { tone: "mid" }, { name: `${id}.stem` });
    // hex socket
    discAt(UF, MZ + MAN_R + 6, MZ + MAN_R + 8, 1.5, { tone: "mid" }, { name: `${id}.socket` });
    const GZ = MZ + MAN_R + 8 + 5.6;
    const n = [0, 1, 0];
    const GF = G.frameOf([GAUGE_X, MY, GZ], n, [1, 0, 0], [0, 0, 1]);
    const caseR = 5.6;
    const c0 = -1.4;
    const c1 = 1.6;
    put([GAUGE_X, MY, GZ], S(G.disc(c0, c1, caseR, GF, P, { bevel: 0.4 }), { tone: "hi" }) + Ln(G.circleOf(GF, c1, caseR - 0.9, P), { tone: "mid" }), { name: `${id}.case`, shapes: [record(A.disc(GF, c0, c1, caseR, { name: `${id}.case` }))] });
    // dial: ticks over 270 degrees, needle drawn by the live page
    const face = c1 + 0.02;
    const ticks = [];
    for (let i = 0; i <= 20; i++) {
      const a = (-225 + (270 * i) / 20) * DEG;
      const r0 = i % 5 === 0 ? caseR - 3.2 : caseR - 2.5;
      ticks.push(path([G.pointOf(GF, face, r0, a), G.pointOf(GF, face, caseR - 1.6, a)]));
    }
    const arc = path(Array.from({ length: 41 }, (_, i) => G.pointOf(GF, face, caseR - 1.6, (-225 + (270 * i) / 40) * DEG)));
    const red = path(Array.from({ length: 9 }, (_, i) => G.pointOf(GF, face, caseR - 1.9, (-225 + 270 * 0.8 + (270 * 0.2 * i) / 8) * DEG)));
    put(G.add3([GAUGE_X, MY, GZ], [0, c1 + 0.1, 0]), Ln(arc, { tone: "lo" }) + Ln(ticks.join(""), { tone: "mid" }) + `<path class="iso-line hx-redline" d="${red}"/>` + `<path class="iso-line" data-tone="lit" data-free="start" data-live="needle" d="" style="stroke-width:1"/>` + Dots([at(G.pointOf(GF, face, 0, 0))], { size: 0.7, tone: "hi" }), {
      bias: 0.2,
      name: `${id}.dial`,
      shapes: [record(A.disc(GF, c1, c1 + 0.1, caseR - 1, { name: `${id}.dial` }))],
    });
    live.gauge = { c: at(G.pointOf(GF, face, 0, 0)), u: G.sub3(at(G.pointOf(GF, face, 1, 0)), [0, 0, 0]), F: GF, face, r: caseR - 2, tail: 1.2 };
    // screen basis for the needle: point at (r, angle) on the face
    const o = at(G.pointOf(GF, face, 0, 0));
    const ux = at(G.add3(G.pointOf(GF, face, 0, 0), GF.u));
    const uz = at(G.add3(G.pointOf(GF, face, 0, 0), GF.v));
    live.gauge = { o, u: [ux[0] - o[0], ux[1] - o[1]], v: [uz[0] - o[0], uz[1] - o[1]], r: caseR - 2.1, tail: 1.3, from: -225, span: 270, max: 6 };
    void stem;
  }

  // chemical injection: pump discharge up and across into a quill on the run
  const QUILL_X = -146;
  {
    const UF = G.frameOf([QUILL_X, MY, MZ], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
    const id = nameFor("skid.quill");
    put([QUILL_X, MY - MAN_R - 1, MZ], S(G.saddleOf(UF, 2.2, (a) => Math.sqrt(Math.max(0, MAN_R * MAN_R - (2.2 * Math.cos(a)) ** 2)), MAN_R + 2.2, P), { tone: "hi" }), { name: `${id}.boss`, shapes: [record(A.disc(UF, MAN_R - 0.9, MAN_R + 2.2, 2.2, { name: `${id}.boss`, seated: true, cut: [A.tube([[RISER[0], MY, MZ], [HOSE_X, MY, MZ]], MAN_R, { name: "skid.manifold", piece: "rig" })] }))] });
    const start = [QUILL_X, MY - MAN_R - 2.2, MZ];
    pipe([PUMP_TOP, [PUMP_TOP[0], PUMP_TOP[1], MZ + 9], [PUMP_TOP[0], MY - MAN_R - 8, MZ + 9], [QUILL_X, MY - MAN_R - 8, MZ], start], 0.9, { name: "skid.chem-line", bend: 4, flangeR: [1.4, 2.2], tone: "mid" });
  }

  // hose union on the riser top
  const UNION = [HOSE_X, MY, HOSE_Z];
  {
    const UF = G.frameOf(UNION, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const id = nameFor("skid.union");
    const ribs = G.ribsOf(UF, 0, 3.6, MAN_R * 1.7, 6, P, { fade: [0.1, 0.5] });
    put(G.add3(UNION, [0, 0, 1.8]), S(G.disc(0, 3.6, MAN_R * 1.7, UF, P, { bevel: 0.3 }), { tone: "hi" }) + k.fadedSvg(ribs, { tone: "mid" }), { name: id, shapes: [record(A.disc(UF, 0, 3.6, MAN_R * 1.7, { name: id }))] });
  }

  // ------------------------------------------------------------ steam hose to the shell inlet
  {
    const top = [IN_PORT[0], IN_PORT[1], IN_PORT[2]];
    // companion flange and hose tail on the nozzle
    const F = G.frameOf(top, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    discAt(F, 0, 3, 9.2, { tone: "hi" }, { name: "hose.adapter", extra: Dots(G.dotsOf(F, 3, 7, 8, P, { all: true }), { size: 0.42 }) });
    discAt(F, 3, 8, 4.4, { tone: "hi" }, { name: "hose.tail", inner: Ln(G.arcOf(F, 5.5, 4.4, P), { tone: "faint" }) });
    const ends = [[UNION[0], UNION[1], UNION[2] + 3.6], [top[0], top[1], top[2] + 8]];
    const route = G.fillet([ends[0], [UNION[0], UNION[1], 92], [UNION[0], 34, 132], [top[0], top[1], 132], ends[1]], 16, 18, { P, tube: 2.8 });
    tubeItems(route, 2.8, { name: "hose.steam", tone: "hi", maxLength: 16, spacing: 1, rings: { pitch: 2.4, twist: 1.1, cross: true, fade: [0.1, 0.55], tone: "lo" } });
    live.hose = route;
  }

  // ------------------------------------------------------------ vapor line to the knockout drum
  const DRUM = [OUT_PORT[0], -98];
  const DR = 16;
  const D0 = 32; // straight shell bottom
  const D1 = 100; // straight shell top
  const HD = 8; // head depth
  const DF = G.frameOf([DRUM[0], DRUM[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const drumR = (s) => (s < D0 ? DR * Math.sqrt(Math.max(0, 1 - ((D0 - s) / HD) ** 2)) : s > D1 ? DR * Math.sqrt(Math.max(0, 1 - ((s - D1) / HD) ** 2)) : DR);
  const drumSlope = (s) => {
    if (s >= D0 && s <= D1) return 0;
    const x = s < D0 ? (D0 - s) / HD : (s - D1) / HD;
    const sign = s < D0 ? 1 : -1;
    if (x >= 0.999) return sign * 60;
    return (sign * DR * x) / (HD * Math.sqrt(1 - x * x));
  };
  const drumProfile = [];
  for (let i = 0; i <= 14; i++) {
    const s = D0 - HD * Math.cos((i / 14) * (Math.PI / 2));
    drumProfile.push([s, drumR(s), i > 0 ? 1 : 0]);
  }
  for (let i = 1; i <= 14; i++) {
    const s = D1 + HD * Math.sin((i / 14) * (Math.PI / 2));
    drumProfile.push([s, drumR(s), i < 14 ? 1 : 0]);
  }
  drumProfile[0][1] = 0.0001;
  const DRUM_SHAPE = A.solid(DF, drumProfile, { radius: drumR, name: "drum.vessel" });
  {
    const bands = G.bandsOf(drumProfile, [D0 + 18, D1 - 10], DF, P, { radius: drumR, slope: drumSlope, rows: 6 });
    bands.bands.forEach((band, index) => {
      const id = nameFor("drum.vessel");
      const sides = bands.sidesOf(band.s0, band.s1, { ends: false });
      const seams = (index < bands.bands.length - 1 ? band.seam : "") + (index === 0 ? G.arcOf(DF, D0, DR, P) : index === bands.bands.length - 1 ? G.arcOf(DF, D1, DR, P) : "");
      put(G.add3(DF.o, [0, 0, (band.s0 + band.s1) / 2]), S(band.paths, { tone: "hi", inner: Ln(seams, { tone: "faint" }) }) + `<path class="iso-line iso-edge" data-tone="hi" d="${sides.d}"/>`, { name: id, shapes: [record(A.solid(DF, band.profile, { radius: drumR, name: id }))] });
    });
  }
  // four legs, tangent to the shell, on base plates
  for (const deg of [45, 135, 225, 315].sort((a, b) => G.dot3(G.radialOf(DF, a * DEG), V) - G.dot3(G.radialOf(DF, b * DEG), V))) {
    const p = G.pointOf(DF, 0, DR + 1.9, deg * DEG);
    boxAt({ x: p[0] - 3.5, y: p[1] - 3.5, w: 7, d: 7, r: 0.6 }, 0, 1.2, { tone: "mid" }, { name: "drum.leg-plate", bevel: 0.2, extra: Dots([at([p[0], p[1], 1.2])], { size: 0.4 }) });
    discAt(G.frameOf([p[0], p[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 1.2, D0 + 14, 1.9, { tone: "mid" }, { name: "drum.leg", rims: "last" });
  }
  // top inlet nozzle at the crown, vapor outlet beside it, drain at the bottom
  const crownAt = (rho) => D1 + HD * Math.sqrt(Math.max(0, 1 - (rho / DR) ** 2));
  const IN_N = { x: DRUM[0], y: DRUM[1] };
  {
    const a = 4.4;
    discAt(DF, crownAt(a) - 0.05, D1 + HD + 5, 4, { tone: "hi" }, { name: "drum.inlet-neck", rims: "last" });
    flangeAt([DRUM[0], DRUM[1], D1 + HD + 6.1], [0, 0, 1], 8.2, 2.2, { name: "drum.inlet-flange" });
  }
  const DRUM_IN = [DRUM[0], DRUM[1], D1 + HD + 7.2];
  const vapor = pipe([OUT_PORT, [OUT_PORT[0], OUT_PORT[1], 134], [DRUM[0], DRUM[1], 134], DRUM_IN], 4, { name: "line.vapor", bend: 3.2, flangeR: 2.05, valveAt: (p) => Math.abs(p[1] - (OUT_PORT[1] + DRUM[1]) / 2) + Math.abs(p[2] - 134) * 10 });
  gateValve(vapor, vapor.valve, 4, { name: "line.vapor-valve" });
  // vapor outlet: offset nozzle on the head, up to the carbon canister
  const VENT = [DRUM[0] + 11 * Math.cos(-75 * DEG), DRUM[1] + 11 * Math.sin(-75 * DEG)];
  {
    const a = 2.2;
    const NF = G.frameOf([VENT[0], VENT[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const start = (ang) => crownAt(Math.hypot(VENT[0] + a * Math.cos(ang) - DRUM[0], VENT[1] + a * Math.sin(ang) - DRUM[1]));
    const low = Math.min(...Array.from({ length: 24 }, (_, i) => start((i / 24) * Math.PI * 2)));
    put([VENT[0], VENT[1], crownAt(11) + 2], S(G.saddleOf(NF, a, start, D1 + HD + 2, P), { tone: "hi" }), { name: "drum.vent-neck", shapes: [record(A.disc(NF, low - 0.05, D1 + HD + 2, a, { name: "drum.vent-neck", seated: true, cut: [{ ...DRUM_SHAPE, piece: "rig" }] }))] });
    flangeAt([VENT[0], VENT[1], D1 + HD + 2.7], [0, 0, 1], 3.6, 1.4, { bolts: 0, name: "drum.vent-flange" });
  }
  const CAN = [104, -96];
  const CAN_R = 9;
  const CAN_H = 34;
  {
    const CF = G.frameOf([CAN[0], CAN[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    discAt(CF, 0, 1.6, CAN_R + 2.4, { tone: "lo" }, { name: "can.plinth" });
    discAt(CF, 1.6, 13.2, CAN_R, { tone: "hi" }, { name: "can.body", rims: "first" });
    discAt(CF, 14.8, CAN_H, CAN_R, { tone: "hi" }, { name: "can.body", rims: "last", inner: Ln(G.arcOf(CF, 24, CAN_R, P), { tone: "faint" }) });
    discAt(CF, CAN_H, CAN_H + 1.8, CAN_R + 0.8, { tone: "mid" }, { name: "can.lid", extra: Dots(G.dotsOf(CF, CAN_H + 1.8, CAN_R - 0.6, 10, P, { all: true }), { size: 0.35 }) });
    discAt(CF, 13.2, 14.8, CAN_R + 0.5, { tone: "mid" }, { name: "can.band" });
    // treated vent: small stack with a rain cap
    const SF = G.frameOf([CAN[0] - 4, CAN[1] + 3, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    discAt(SF, CAN_H + 1.8, CAN_H + 12, 1.2, { tone: "mid" }, { name: "can.stack" });
    discAt(SF, CAN_H + 12, CAN_H + 13.4, 2.8, { tone: "mid" }, { name: "can.raincap" });
  }
  pipe([[VENT[0], VENT[1], D1 + HD + 3.4], [VENT[0], VENT[1], 122], [CAN[0] + 3, CAN[1] - 1, 122], [CAN[0] + 3, CAN[1] - 1, CAN_H + 1.8]], 1.6, { name: "line.vent", bend: 3, flangeR: 2.2, tone: "hi" });

  // sight glass on the drum, toward the viewer
  {
    const look = Math.atan2(V[1], V[0]) - 18 * DEG;
    const n = [Math.cos(look), Math.sin(look), 0];
    const t = [-n[1], n[0], 0];
    const base = [DRUM[0] + n[0] * (DR + 5.5), DRUM[1] + n[1] * (DR + 5.5)];
    const z0 = 44;
    const z1 = 94;
    for (const z of [z0 + 3, z1 - 3]) {
      const NF = G.frameOf([DRUM[0], DRUM[1], z], n, t, [0, 0, 1]);
      const id = nameFor("drum.gauge-stub");
      put(G.add3([DRUM[0], DRUM[1], z], G.mul3(n, DR + 2)), S(G.disc(DR - 0.2, DR + 4.2, 1.3, NF, P), { tone: "mid" }), { name: id, shapes: [record(A.disc(NF, DR - 0.2, DR + 4.2, 1.3, { name: id }))] });
    }
    const GF = G.frameOf([base[0], base[1], 0], [0, 0, 1], t, n);
    const body = [[-2.4, -1.4], [2.4, -1.4], [2.4, 1.6], [-2.4, 1.6]];
    const id = nameFor("drum.gauge");
    const o = [base[0] + n[0] * 1.62, base[1] + n[1] * 1.62, z0 + 4];
    const sx = at(G.add3(o, t));
    const sz = at(G.add3(o, [0, 0, 1]));
    const so = at(o);
    const mat = `matrix(${(sx[0] - so[0]).toFixed(4)} ${(sx[1] - so[1]).toFixed(4)} ${(so[0] - sz[0]).toFixed(4)} ${(so[1] - sz[1]).toFixed(4)} ${so[0].toFixed(2)} ${so[1].toFixed(2)})`;
    const glassH = z1 - z0 - 8;
    const glass = `<g transform="${mat}"><rect class="hx-glass" x="-1.1" y="${-glassH}" width="2.2" height="${glassH}" rx="0.6"/><rect class="hx-liquid" data-live="drum-liquid" x="-1.1" y="0" width="2.2" height="0" rx="0.6"/>${[0.25, 0.5, 0.75].map((f) => `<path class="iso-line" data-tone="mid" d="M1.1 ${(-glassH * f).toFixed(2)}H2.0"/>`).join("")}<rect class="hx-glass-rim" x="-1.1" y="${-glassH}" width="2.2" height="${glassH}" rx="0.6"/></g>`;
    put(G.add3(o, [0, 0, glassH / 2]), S(G.prismOf(GF, body, z0, z1, P), { tone: "hi" }) + glass + Dots([0.4, 0.9].flatMap((f) => [-1.8, 1.8].map((dx) => at(G.add3(G.add3(o, G.mul3(t, dx)), [0, 0, glassH * f - 2])))), { size: 0.35 }), {
      name: id,
      shapes: [record(A.prism(GF, body, z0, z1, { name: id }))],
    });
    live.drum = { h: glassH };
  }
  // drain from the bottom head to a closed-drain hub on the pad
  {
    const bottom = [DRUM[0], DRUM[1], D0 - HD];
    discAt(DF, D0 - HD - 2.6, D0 - HD + 0.4, 2, { tone: "hi" }, { name: "drum.drain-neck", rims: "first" });
    flangeAt([bottom[0], bottom[1], D0 - HD - 3.3], [0, 0, 1], 3.4, 1.4, { bolts: 0, name: "drum.drain-flange" });
    const HUB = [DRUM[0] + 30, DRUM[1] - 10];
    const HF = G.frameOf([HUB[0], HUB[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    discAt(HF, 0, 2, 6, { tone: "lo" }, { name: "stand.drain-hub", extra: Ln(G.circleOf(HF, 2, 4, P), { tone: "faint" }) });
    discAt(HF, 2, 4.4, 2.2, { tone: "mid" }, { name: "stand.drain-riser" });
    flangeAt([HUB[0], HUB[1], 5.1], [0, 0, 1], 3.4, 1.4, { bolts: 0, name: "stand.drain-flange" });
    const drain = pipe([[bottom[0], bottom[1], D0 - HD - 4], [bottom[0], bottom[1], 12], [HUB[0], HUB[1], 12], [HUB[0], HUB[1], 5.8]], 1.5, { name: "line.drain", bend: 3, flangeR: 2.1 });
    void drain;
  }
  void IN_N;

  // ------------------------------------------------------------ control cabinet with a live screen
  {
    const CAB = { x: -40, y: 64, w: 32, d: 15, r: 0.8 };
    const PL = { x: CAB.x - 3, y: CAB.y - 3, w: CAB.w + 6, d: CAB.d + 6, r: 1 };
    boxAt(PL, 0, 3, { tone: "lo" }, { name: "stand.cabinet-plinth", bevel: 0.4, extra: Dots(k.corners(PL, 1.8).map(([x, y]) => at([x, y, 3])), { size: 0.42 }) });
    const top = 50;
    const front = CAB.y + CAB.d;
    const doorX0 = CAB.x + 1.6;
    const doorX1 = CAB.x + CAB.w - 1.6;
    // door seam and hinge line, edge to edge on the front face
    const seam = path([[doorX0, front + 0.05, 4.6], [doorX1, front + 0.05, 4.6], [doorX1, front + 0.05, top - 1.6], [doorX0, front + 0.05, top - 1.6]], true);
    const hinges = [12, 36].map((z) => path([[doorX0 + 0.2, front + 0.05, z], [doorX0 + 1.2, front + 0.05, z], [doorX0 + 1.2, front + 0.05, z + 4], [doorX0 + 0.2, front + 0.05, z + 4]], true)).join("");
    const handle = path([[doorX1 - 2.8, front + 0.05, 22], [doorX1 - 1.8, front + 0.05, 22], [doorX1 - 1.8, front + 0.05, 28], [doorX1 - 2.8, front + 0.05, 28]], true);
    const vents = [8, 10.4, 12.8].map((z) => path([[CAB.x + CAB.w + 0.05, CAB.y + 3, z], [CAB.x + CAB.w + 0.05, CAB.y + CAB.d - 3, z], [CAB.x + CAB.w + 0.05, CAB.y + CAB.d - 3, z + 1], [CAB.x + CAB.w + 0.05, CAB.y + 3, z + 1]], true)).join("");
    // screen in the plane of the front face: local x along +x, local y down
    const SCR = { x0: 3.2, x1: 28.8, z0: 30, z1: 44.6 };
    const mat = k.sideMatrix([CAB.x, front + 0.06], 0, P, "left");
    const sw = SCR.x1 - SCR.x0;
    const sh = SCR.z1 - SCR.z0;
    const screen = `<g transform="${mat}"><clipPath id="hx-screen"><rect x="${SCR.x0}" y="${-SCR.z1}" width="${sw}" height="${sh}" rx="0.8"/></clipPath><rect class="hx-screen" x="${SCR.x0}" y="${-SCR.z1}" width="${sw}" height="${sh}" rx="0.8"/><g clip-path="url(#hx-screen)" class="hx-screen-text"><text x="${SCR.x0 + 1.4}" y="${-SCR.z1 + 3.4}" data-live="scr-phase">ISOLATED</text><text x="${SCR.x0 + 1.4}" y="${-SCR.z1 + 7.4}" data-live="scr-lel">LEL   0%</text><text x="${SCR.x0 + 1.4}" y="${-SCR.z1 + 11.4}" data-live="scr-u">U    54%</text><rect class="hx-bar-bg" x="${SCR.x0 + 1.4}" y="${-SCR.z0 - 2}" width="${sw - 2.8}" height="0.9"/><rect class="hx-bar" data-live="scr-bar" x="${SCR.x0 + 1.4}" y="${-SCR.z0 - 2}" width="0" height="0.9"/></g><rect class="hx-screen-rim" x="${SCR.x0}" y="${-SCR.z1}" width="${sw}" height="${sh}" rx="0.8"/>${[0, 1, 2].map((i) => `<circle class="hx-lamp" data-live="lamp-${i}" cx="${SCR.x0 + 3 + i * 4}" cy="${-SCR.z0 + 5}" r="1.1"/>`).join("")}</g>`;
    const id = nameFor("stand.cabinet");
    put([CAB.x + CAB.w / 2, CAB.y + CAB.d / 2, 26], S(k.slabOf(CAB, 3, top - 3, P, 2, 0.6), { tone: "hi", inner: Ln(k.sideSeam(CAB, 4.6, P, 2), { tone: "faint" }) }) + Ln(seam, { tone: "lo" }) + Ln(hinges + handle, { tone: "mid" }) + Ln(vents, { tone: "lo" }) + screen, {
      name: id,
      shapes: [record(A.slab(CAB, 3, top - 3, { name: id }, 2))],
    });
    const HOOD = { x: CAB.x - 2, y: CAB.y - 1, w: CAB.w + 4, d: CAB.d + 4, r: 0.8 };
    boxAt(HOOD, top, 1.6, { tone: "mid" }, { name: "stand.cabinet-hood", bevel: 0.4 });
    // power and signal cable from the cabinet, along the pad, to the motor box
    const JB = { x: SKID.x + SKID.w, y: 62, w: 6, d: 10, r: 0.5 };
    boxAt(JB, 3, 6, { tone: "mid" }, { name: "skid.junction-box", bevel: 0.3, extra: Dots([at([JB.x + 3, JB.y + 2, 9]), at([JB.x + 3, JB.y + 8, 9])], { size: 0.4 }) });
    const route = G.fillet([[CAB.x, 71.5, 8], [CAB.x - 6, 71.5, 8], [CAB.x - 6, 71.5, 0.7], [JB.x + 3, 71.5, 0.7], [JB.x + 3, 67, 0.7], [JB.x + 3, 67, 3]], 2.4, 10, { P, tube: 0.7 });
    tubeItems(route, 0.7, { name: "stand.cabinet-cable", tone: "mid", maxLength: 14, spacing: 1, limp: true, touch: ["stand.pad"] });
    live.screen = true;
  }
  return live;
}
