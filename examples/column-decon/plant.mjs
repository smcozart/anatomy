// Everything around the column: manways, ladder and platforms, the overhead circuit to
// an air-cooled condenser, the reflux drum and pump, the reboiler, the cleaning skid,
// the gas board and the carbon-canister vent.
export function plant(ctx) {
  const { k, G, A, P, V, KS, at, S, Ln, Dots, path, FADE, record, nameFor, piece, put, tubeItems, discAt, flangeAt, boxAt, ballAt, plateSvg, plateAt, pipe, gateValve, R, COL, onCol, radial, tangent, VIEW_A, Z_TOP, HEAD_D, Z_TAN, Z_SKIRT, JOINTS, DEG } = ctx;
  const live = { covers: [], fans: [] };
  const SHELL_HOST = (z0, z1, p) => ({ ...A.disc(COL, z0, z1, R, { name: `${p}.shell` }), piece: p, move: ctx.moveOf(p) });

  // A nozzle leaving the shell radially at height z and angle a: saddle neck, then a flange.
  function shellNozzle(p, z, a, r, reach, { flangeR = r * 1.7, thick = 2, name, blind = false, host } = {}) {
    piece(p);
    const n = radial(a);
    const F = G.frameOf([0, 0, z], n, tangent(a), [0, 0, 1]);
    const id = nameFor(name ?? `${p}.nozzle`);
    const start = (ang) => Math.sqrt(Math.max(0, R * R - (r * Math.cos(ang)) ** 2));
    put(onCol(z, R + reach / 2, a), S(G.saddleOf(F, r, start, R + reach, P), { tone: "hi" }), { name: id, shapes: [record(A.disc(F, R - r - 0.5, R + reach, r, { name: id, seated: true, cut: [host ?? SHELL_HOST(z - 40, z + 40, p)] }))] });
    flangeAt(onCol(z, R + reach + thick / 2, a), n, flangeR, thick, { name: `${id}.flange` });
    if (blind) flangeAt(onCol(z, R + reach + thick * 1.5, a), n, flangeR, thick, { name: `${id}.blind` });
    return { port: onCol(z, R + reach + thick * (blind ? 2 : 1), a), n, face: R + reach + thick };
  }

  // ------------------------------------------------------------ manways, opened when the column is gas-free
  const MA = VIEW_A - 74 * DEG;
  [["c1", 150], ["c2", 262], ["c3", 368]].forEach(([p, z], index) => {
    const noz = shellNozzle(p, z, MA, 8.5, 6, { flangeR: 12.5, thick: 2.2, name: `${p}.manway` });
    const n = noz.n;
    const F = G.frameOf([0, 0, z], n, tangent(MA), [0, 0, 1]);
    const s0 = noz.face;
    const s1 = s0 + 2.4;
    const id = nameFor(`${p}.manway-cover`);
    const towards = G.dot3(n, V) > 0;
    const bolts = towards ? Dots(G.dotsOf(F, s1, 10.6, 16, P, { all: true }), { size: 0.45, tone: "mid" }) : "";
    const handle = towards ? Ln(path([G.pointOf(F, s1, 3.5, Math.PI / 2), G.pointOf(F, s1 + 1.6, 3.5, Math.PI / 2), G.pointOf(F, s1 + 1.6, 3.5, -Math.PI / 2), G.pointOf(F, s1, 3.5, -Math.PI / 2)], true), { tone: "mid" }) : "";
    put(onCol(z, (s0 + s1) / 2, MA), `<g data-live="cover" data-cover="${index}">${S(G.disc(s0, s1, 12.5, F, P, { bevel: 0.4 }), { tone: "hi" })}${bolts}${handle}</g>`, { bias: 0.1, name: id, shapes: [record(A.disc(F, s0, s1, 12.5, { name: id }))] });
    const o = at(onCol(z, 0, MA));
    const e = at(onCol(z, 1, MA));
    live.covers.push([e[0] - o[0], e[1] - o[1]]);
  });

  // ------------------------------------------------------------ caged ladder and platforms on the left
  const LA = VIEW_A + 96 * DEG;
  const PLAT = [["c1", JOINTS[0] - 12], ["c2", JOINTS[1] - 12], ["c3", Z_TOP - 2]];
  const PA = [VIEW_A + 104 * DEG, VIEW_A + 208 * DEG];
  PLAT.forEach(([p, z]) => {
    piece(p);
    const r0 = R + 1;
    const r1 = R + 20;
    const steps = 28;
    const outer = Array.from({ length: steps + 1 }, (_, i) => PA[0] + ((PA[1] - PA[0]) * i) / steps);
    const poly = [...outer.map((a) => [r1 * Math.cos(a), r1 * Math.sin(a)]), ...[...outer].reverse().map((a) => [r0 * Math.cos(a), r0 * Math.sin(a)])];
    const F = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const top = z + 1.4;
    const grating = [R + 6, R + 11, R + 16].map((r) => path(outer.map((a) => onCol(top, r, a)))).join("");
    const posts = [];
    const rails = [];
    const postA = Array.from({ length: 8 }, (_, i) => PA[0] + ((PA[1] - PA[0]) * i) / 7);
    for (const a of postA) posts.push(path([onCol(top, r1 - 0.25, a), onCol(top + 14, r1 - 0.25, a)]));
    for (const h of [7, 14]) rails.push(path(outer.map((a) => onCol(top + h, r1 - 0.25, a))));
    const id = nameFor(`${p}.platform`);
    put(onCol(z, (r0 + r1) / 2, (PA[0] + PA[1]) / 2), plateSvg(F, poly, z, top, "mid") + Ln(grating, { tone: "faint" }) + Ln(posts.join("") + rails.join(""), { tone: "mid" }), {
      name: id,
      shapes: [record(A.prism(F, poly, z, top, { name: id }))],
    });
    // knee brackets under the deck
    for (const a of [PA[0] + 10 * DEG, (PA[0] + PA[1]) / 2, PA[1] - 10 * DEG]) {
      const BF = G.frameOf([0, 0, 0], tangent(a), radial(a), [0, 0, 1]);
      plateAt(BF, [[R - 0.05, z - 14], [R - 0.05, z], [R + 17, z]], -0.5, 0.5, { name: `${p}.bracket` });
    }
  });
  // ladder: two rails, rungs and a cage, one run per section
  const LADDER = [["c1", Z_SKIRT, JOINTS[0] - 0.3], ["c2", JOINTS[0] + 0.3, JOINTS[1] - 0.3], ["c3", JOINTS[1] + 0.3, PLAT[2][1] + 15.4]];
  const LR = R + 21.5;
  for (const [p, z0, z1] of LADDER) {
    piece(p);
    const c = (z) => onCol(z, LR, LA);
    const t = tangent(LA);
    const rail = (side, z) => G.add3(c(z), G.mul3(t, side * 4));
    for (const side of [-1, 1]) {
      const a = rail(side, p === "c1" ? 0 : z0);
      const b = rail(side, z1);
      const id = nameFor(`${p}.ladder-rail`);
      const RF = G.frameOf(a, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
      put(G.lerp3(a, b, 0.5), S(G.disc(0, b[2] - a[2], 0.6, RF, P), { tone: "mid" }), { name: id, shapes: [record(A.disc(RF, 0, b[2] - a[2], 0.6, { name: id }))] });
    }
    const rungs = [];
    for (let z = z0 + 3; z < z1 - 1; z += 3.2) rungs.push(path([rail(-1, z), rail(1, z)]));
    const cage = [];
    const hoops = [];
    for (let z = z0 + 26; z <= z1; z += 10) hoops.push(z);
    const out = radial(LA);
    const hoop = (z) => Array.from({ length: 13 }, (_, i) => {
      const th = (i / 12) * Math.PI;
      return G.add3(G.add3(c(z), G.mul3(t, 4 * Math.cos(th))), G.mul3(out, 7 * Math.sin(th)));
    });
    for (const z of hoops) cage.push(path(hoop(z)));
    if (hoops.length > 1)
      for (const i of [3, 6, 9]) cage.push(path(hoops.map((z) => hoop(z)[i])));
    const id = nameFor(`${p}.ladder`);
    const mid = (z0 + z1) / 2;
    const half = (z1 - z0) / 2;
    const shapes = [record(A.orientedBox(c(mid), [out, t, [0, 0, 1]], [0.3, 3.3, half], { name: id }))];
    if (hoops.length) shapes.push(record(A.orientedBox(G.add3(c(mid), G.mul3(out, 3.8)), [out, t, [0, 0, 1]], [3.2, 4.6, half], { name: `${id}.cage` })));
    put(c(mid), Ln(rungs.join(""), { tone: "mid" }) + Ln(cage.join(""), { tone: "lo" }), { bias: 0.3, name: id, shapes });
    // standoff clips holding the rails to the shell
    for (let z = z0 + 14; z < z1 - 6; z += 40) {
      const BF = G.frameOf([0, 0, 0], [0, 0, 1], radial(LA), tangent(LA));
      for (const side of [-4, 4]) plateAt(BF, [[R - 0.05, side - 0.6], [LR - 0.6, side - 0.6], [LR - 0.6, side + 0.6], [R - 0.05, side + 0.6]], z - 0.7, z + 0.7, { name: `${p}.ladder-clip` });
    }
  }

  // ------------------------------------------------------------ top nozzle and the overhead line
  piece("c3");
  const crown = Z_TOP + HEAD_D;
  const headAt = (rho) => Z_TOP + HEAD_D * Math.sqrt(Math.max(0, 1 - (rho / R) ** 2));
  discAt(COL, headAt(7.4) - 0.05, crown + 7, 7, { tone: "hi" }, { name: "c3.overhead-neck", rims: "last" });
  flangeAt([0, 0, crown + 8.2], [0, 0, 1], 12, 2.4, { name: "c3.overhead-flange" });
  // the rack and condenser sit back and to the right
  const RACK = { x0: 70, x1: 180, y0: -128, y1: -64, z: 122 };
  const FY = (RACK.y0 + RACK.y1) / 2;
  const IN_X = RACK.x0 - 2;
  const overhead = pipe([[0, 0, crown + 9.4], [0, 0, 462], [IN_X, 0, 462], [IN_X, FY, 462], [IN_X, FY, RACK.z + 24.4]], 6, { name: "c3.overhead", bend: 2.4, flangeR: 2, free: [false, true] });
  void overhead;

  // ------------------------------------------------------------ pipe rack with the air-cooled condenser
  piece("stand");
  const COLS = [[RACK.x0 + 4, RACK.y0 + 4], [RACK.x1 - 4, RACK.y0 + 4], [RACK.x0 + 4, RACK.y1 - 4], [RACK.x1 - 4, RACK.y1 - 4]];
  for (const [x, y] of COLS) {
    boxAt({ x: x - 5, y: y - 5, w: 10, d: 10, r: 0.6 }, 0, 2, { tone: "lo" }, { name: "stand.rack-footing", bevel: 0.3 });
    boxAt({ x: x - 2.4, y: y - 2.4, w: 4.8, d: 4.8, r: 0.3 }, 2, RACK.z - 6 - 2, { tone: "mid" }, { name: "stand.rack-column", bevel: 0.3 });
  }
  boxAt({ x: RACK.x0, y: RACK.y0, w: RACK.x1 - RACK.x0, d: RACK.y1 - RACK.y0, r: 0.6 }, RACK.z - 6, 3, { tone: "mid" }, { name: "stand.rack-deck", bevel: 0.4, inner: Ln(k.sideSeam({ x: RACK.x0, y: RACK.y0, w: RACK.x1 - RACK.x0, d: RACK.y1 - RACK.y0, r: 0.6 }, RACK.z - 4.5, P, 3), { tone: "faint" }) });
  for (const y of [RACK.y0 + 4, RACK.y1 - 4]) boxAt({ x: RACK.x0 + 6.4, y: y - 1.6, w: RACK.x1 - RACK.x0 - 12.8, d: 3.2, r: 0.2 }, 50, 3, { tone: "mid" }, { name: "stand.rack-strut", bevel: 0.2 });
  // tube bundle with headers at both ends
  const BUN = { x: RACK.x0 + 8, y: RACK.y0 + 2, w: RACK.x1 - RACK.x0 - 16, d: RACK.y1 - RACK.y0 - 4, r: 0.4 };
  const finLines = [];
  for (let x = BUN.x + 1.6; x < BUN.x + BUN.w - 1; x += 1.6) finLines.push(k.segment([x, BUN.y + BUN.d, RACK.z - 3], [x, BUN.y + BUN.d, RACK.z + 10], P));
  boxAt(BUN, RACK.z - 3, 13, { tone: "hi" }, { name: "stand.fin-bundle", bevel: 0.3, extra: Ln(finLines.join(""), { tone: "faint" }) });
  for (const x of [RACK.x0, RACK.x1 - 8]) {
    const plan = { x, y: RACK.y0 + 1, w: 8, d: RACK.y1 - RACK.y0 - 2, r: 0.5 };
    const plugs = [];
    for (let y = plan.y + 4; y < plan.y + plan.d - 2; y += 4.4) for (const z of [RACK.z + 1, RACK.z + 6]) plugs.push(at([x + 8, y, z]));
    boxAt(plan, RACK.z - 3, 15, { tone: "hi" }, { name: "stand.fin-header", bevel: 0.4, extra: Dots(x > RACK.x0 ? plugs : [], { size: 0.5, tone: "mid" }) });
  }
  // inlet nozzle on the left header
  {
    const F = G.frameOf([IN_X, FY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    discAt(F, RACK.z + 12, RACK.z + 22, 6, { tone: "hi" }, { name: "stand.fin-inlet" });
    flangeAt([IN_X, FY, RACK.z + 23.2], [0, 0, 1], 12, 2.4, { name: "stand.fin-inlet-flange" });
  }
  // plenum and two fans on top
  const PLEN = { ...BUN, x: BUN.x + 2, w: BUN.w - 4 };
  boxAt(PLEN, RACK.z + 10, 4, { tone: "mid" }, { name: "stand.plenum", bevel: 0.3 });
  const FAN_R = 19;
  for (const fx of [PLEN.x + PLEN.w * 0.27, PLEN.x + PLEN.w * 0.73]) {
    const F = G.frameOf([fx, FY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const z0 = RACK.z + 14;
    const z1 = z0 + 6;
    const id = nameFor("stand.fan-ring");
    const mat = k.topMatrix([fx, FY], z1 - 1.2, P, "x");
    const blades = Array.from({ length: 4 }, (_, i) => {
      const a = (i / 4) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const pt = (r, w) => `${(c * r - s * w).toFixed(2)} ${(-(s * r + c * w)).toFixed(2)}`;
      return `M${pt(2.2, -1.6)}L${pt(FAN_R - 1.4, -2.6)}L${pt(FAN_R - 1.4, 1.6)}L${pt(2.2, 1.2)}Z`;
    }).join("");
    const cid = `cd-fan${live.fans.length}`;
    const fan = `<clipPath id="${cid}"><path d="${G.circleOf(F, z1, FAN_R - 0.6, P)}"/></clipPath><g clip-path="url(#${cid})"><g transform="${mat}"><circle class="cd-fan-well" r="${FAN_R + 2}"/><g data-live="fan"><path class="cd-blade" d="${blades}"/></g><circle class="cd-fan-hub" r="2.4"/></g></g>`;
    put([fx, FY, (z0 + z1) / 2], S(G.ringBand(z0, z1, FAN_R - 0.6, FAN_R + 0.8, F, P), { tone: "mid" }) + fan + Ln(G.circleOf(F, z1, FAN_R - 0.6, P), { tone: "hi" }), {
      name: id,
      shapes: [record(A.ring(F, z0, z1, FAN_R - 0.6, FAN_R + 0.8, { name: id }))],
    });
    live.fans.push(true);
  }

  // ------------------------------------------------------------ reflux drum under the rack, pump, reflux line
  const DRUM = { y: FY, z: 26, x0: RACK.x0 + 18, x1: RACK.x1 - 18, r: 13 };
  const DF = G.frameOf([0, DRUM.y, DRUM.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const dHead = 6.5;
  const drumR = (s) => (s < DRUM.x0 ? DRUM.r * Math.sqrt(Math.max(0, 1 - ((DRUM.x0 - s) / dHead) ** 2)) : s > DRUM.x1 ? DRUM.r * Math.sqrt(Math.max(0, 1 - ((s - DRUM.x1) / dHead) ** 2)) : DRUM.r);
  const drumSlope = (s) => {
    if (s >= DRUM.x0 && s <= DRUM.x1) return 0;
    const x = s < DRUM.x0 ? (DRUM.x0 - s) / dHead : (s - DRUM.x1) / dHead;
    const sign = s < DRUM.x0 ? 1 : -1;
    if (x >= 0.999) return sign * 60;
    return (sign * DRUM.r * x) / (dHead * Math.sqrt(1 - x * x));
  };
  const drumProfile = [];
  for (let i = 0; i <= 12; i++) {
    const s = DRUM.x0 - dHead * Math.cos((i / 12) * (Math.PI / 2));
    drumProfile.push([s, Math.max(0.0001, drumR(s)), i > 0 ? 1 : 0]);
  }
  for (let i = 1; i <= 12; i++) {
    const s = DRUM.x1 + dHead * Math.sin((i / 12) * (Math.PI / 2));
    drumProfile.push([s, Math.max(0.0001, drumR(s)), i < 12 ? 1 : 0]);
  }
  K_turnedDrum();
  function K_turnedDrum() {
    const id = nameFor("stand.reflux-drum");
    const paths = G.solidOf(drumProfile, DF, P, { smooth: { slope: drumSlope, radius: drumR } });
    put([(DRUM.x0 + DRUM.x1) / 2, DRUM.y, DRUM.z], S(paths, { tone: "hi", inner: Ln(G.arcOf(DF, DRUM.x0, DRUM.r, P) + G.arcOf(DF, DRUM.x1, DRUM.r, P), { tone: "faint" }) }), { name: id, shapes: [record(A.solid(DF, drumProfile, { radius: drumR, name: id }))] });
  }
  for (const x of [DRUM.x0 + 10, DRUM.x1 - 10]) {
    const WF = G.frameOf([x, DRUM.y, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const half = 9;
    const web = [[-half, 0], [half, 0]];
    for (let i = 0; i <= 16; i++) {
      const y = half - (2 * half * i) / 16;
      web.push([y, DRUM.z - Math.sqrt(DRUM.r * DRUM.r - y * y)]);
    }
    plateAt(WF, web, -1, 1, { name: "stand.drum-saddle" });
  }
  // condensate down from the right header into the drum top
  {
    const F = G.frameOf([DRUM.x1 - 6, DRUM.y, DRUM.z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const a = 3;
    put([DRUM.x1 - 6, DRUM.y, DRUM.z + DRUM.r + 2], S(G.saddleOf(F, a, (t) => G.saddleStart(DRUM.r, a, t), DRUM.r + 4, P), { tone: "hi" }), { name: "stand.drum-inlet", shapes: [record(A.disc(F, DRUM.r - 1, DRUM.r + 4, a, { name: "stand.drum-inlet", seated: true, cut: [{ ...A.disc(DF, DRUM.x0, DRUM.x1, DRUM.r, { name: "stand.reflux-drum" }), piece: "stand" }] }))] });
    flangeAt([DRUM.x1 - 6, DRUM.y, DRUM.z + DRUM.r + 4.9], [0, 0, 1], 5.4, 1.8, { name: "stand.drum-inlet-flange", bolts: 6 });
    const HF = G.frameOf([RACK.x1 - 4, FY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    discAt(HF, RACK.z - 9, RACK.z - 6, 3, { tone: "hi" }, { name: "stand.fin-outlet" });
    flangeAt([RACK.x1 - 4, FY, RACK.z - 9.9], [0, 0, 1], 5.4, 1.8, { name: "stand.fin-outlet-flange", bolts: 6 });
    pipe([[RACK.x1 - 4, FY, RACK.z - 10.8], [RACK.x1 - 4, FY, 70], [DRUM.x1 - 6, FY, 70], [DRUM.x1 - 6, DRUM.y, DRUM.z + DRUM.r + 5.8]], 3, { name: "stand.condensate", bend: 3, flangeR: 1.8 });
  }
  // drum sight glass, toward the viewer
  {
    const y = DRUM.y + DRUM.r;
    const o = [DRUM.x0 + 16, y + 3.2, DRUM.z - 8];
    const h = 16;
    const sx = at(G.add3(o, [1, 0, 0]));
    const sz = at(G.add3(o, [0, 0, 1]));
    const so = at(o);
    const mat = `matrix(${(sx[0] - so[0]).toFixed(4)} ${(sx[1] - so[1]).toFixed(4)} ${(so[0] - sz[0]).toFixed(4)} ${(so[1] - sz[1]).toFixed(4)} ${so[0].toFixed(2)} ${so[1].toFixed(2)})`;
    for (const z of [o[2] + 1.5, o[2] + h - 1.5]) {
      const NF = G.frameOf([o[0], DRUM.y, DRUM.z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      void NF;
      const id = nameFor("stand.gauge-stub");
      const GF = G.frameOf([o[0], DRUM.y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      const start = Math.sqrt(Math.max(0, DRUM.r * DRUM.r - (z - DRUM.z) ** 2)) - 0.4;
      put([o[0], DRUM.y + start + 1.5, z], S(G.disc(start, DRUM.r + 2.2, 1, GF, P), { tone: "mid" }), { name: id, shapes: [record(A.disc(GF, start, DRUM.r + 2.2, 1, { name: id, seated: true, cut: [{ ...A.disc(DF, DRUM.x0, DRUM.x1, DRUM.r, { name: "stand.reflux-drum" }), piece: "stand" }] }))] });
    }
    const body = [[-2, 0], [2, 0], [2, 2], [-2, 2]];
    const GF = G.frameOf([o[0], DRUM.y + DRUM.r + 2.2, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const glass = `<g transform="${mat}"><rect class="cd-glass" x="-1" y="${-h + 1}" width="2" height="${h - 2}" rx="0.5"/><rect class="cd-liquid" data-live="drum-liquid" x="-1" y="-1" width="2" height="0" rx="0.5"/><rect class="cd-glass-rim" x="-1" y="${-h + 1}" width="2" height="${h - 2}" rx="0.5"/></g>`;
    const id = nameFor("stand.drum-gauge");
    put(G.add3(o, [0, 0, h / 2]), S(G.prismOf(GF, body, o[2], o[2] + h, P), { tone: "hi" }) + glass, { name: id, shapes: [record(A.prism(GF, body, o[2], o[2] + h, { name: id }))] });
    live.drum = { h: h - 2 };
  }
  // reflux pump on its base in front of the drum
  const PUMP = { x: DRUM.x0 + 4, y: RACK.y1 + 14, w: 30, d: 16, r: 0.8 };
  boxAt(PUMP, 0, 3, { tone: "lo" }, { name: "stand.pump-plinth", bevel: 0.4 });
  boxAt({ ...k.insetPlan(PUMP, 1.5) }, 3, 1.6, { tone: "mid" }, { name: "stand.pump-base", bevel: 0.3, extra: Dots(k.corners(k.insetPlan(PUMP, 1.5), 1.6).map(([x, y]) => at([x, y, 4.6])), { size: 0.42 }) });
  const PZ = 12;
  const PY = PUMP.y + PUMP.d / 2;
  const MF = G.frameOf([0, PY, PZ], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  for (const x of [PUMP.x + 6, PUMP.x + 13]) boxAt({ x: x - 1.8, y: PY - 4, w: 3.6, d: 8, r: 0.4 }, 4.6, PZ - 5.5 - 4.6, { tone: "mid" }, { name: "stand.pump-foot", bevel: 0.2 });
  {
    const id = nameFor("stand.pump-motor");
    put([PUMP.x + 9, PY, PZ], S(G.disc(PUMP.x + 3, PUMP.x + 15, 5.5, MF, P), { tone: "hi" }) + k.fadedSvg(G.ribsOf(MF, PUMP.x + 3, PUMP.x + 15, 5.5, 18, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }), { name: id, shapes: [record(A.disc(MF, PUMP.x + 3, PUMP.x + 15, 5.5, { name: id }))] });
    discAt(MF, PUMP.x + 15, PUMP.x + 19, 3, { tone: "mid" }, { name: "stand.pump-coupling" });
    const vol = PUMP.x + 19;
    const head = [[vol, 6.4], [vol + 4, 6.4], [vol + 5.5, 5.4, 1], [vol + 6.4, 3.6, 1], [vol + 6.8, 2]];
    put([vol + 3, PY, PZ], S(G.solidOf(head, MF, P, { smooth: true }), { tone: "hi" }), { name: "stand.pump-casing", shapes: [record(A.solid(MF, head, { name: "stand.pump-casing", curve: head }))] });
  }
  const SUCTION_END = [PUMP.x + 25.8, PY, PZ];
  // suction from the drum bottom to the pump's eye
  {
    const sx = DRUM.x0 + 30;
    const F = G.frameOf([sx, DRUM.y, DRUM.z], [0, 0, -1], [1, 0, 0], [0, 1, 0]);
    const a = 2.6;
    put([sx, DRUM.y, DRUM.z - DRUM.r - 2], S(G.saddleOf(F, a, (t) => G.saddleStart(DRUM.r, a, t), DRUM.r + 3, P), { tone: "hi" }), { name: "stand.drum-outlet", shapes: [record(A.disc(F, DRUM.r - 1, DRUM.r + 3, a, { name: "stand.drum-outlet", seated: true, cut: [{ ...A.disc(DF, DRUM.x0, DRUM.x1, DRUM.r, { name: "stand.reflux-drum" }), piece: "stand" }] }))] });
    flangeAt([sx, DRUM.y, DRUM.z - DRUM.r - 3.8], [0, 0, 1], 4.6, 1.6, { name: "stand.drum-outlet-flange", bolts: 6 });
    pipe([[sx, DRUM.y, DRUM.z - DRUM.r - 4.6], [sx, DRUM.y, 7.4], [sx, PY, 7.4], [SUCTION_END[0] + 6, PY, 7.4], [SUCTION_END[0] + 6, PY, PZ], SUCTION_END], 1.6, { name: "stand.suction", bend: 2.4, flangeR: [2.4, 1.24], breaks: [5] });
  }
  const DIS = [PUMP.x + 22, PY];
  {
    const F = G.frameOf([DIS[0], PY, PZ], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const a = 2.4;
    const start = (t) => Math.sqrt(Math.max(0, 6.4 * 6.4 - (a * Math.sin(t)) ** 2));
    put([DIS[0], PY, PZ + 7], S(G.saddleOf(F, a, start, 9, P), { tone: "hi" }), { name: "stand.pump-discharge", shapes: [record(A.disc(F, 5.6, 9, a, { name: "stand.pump-discharge", seated: true, cut: [{ ...A.disc(MF, PUMP.x + 19, PUMP.x + 23, 6.4, { name: "stand.pump-casing" }), piece: "stand" }] }))] });
    flangeAt([DIS[0], PY, PZ + 9.8], [0, 0, 1], 4.6, 1.6, { name: "stand.pump-discharge-flange", bolts: 6 });
  }
  // reflux: pump discharge up beside the column into the top section
  piece("c3");
  const RFA = VIEW_A - 40 * DEG;
  const reflux = shellNozzle("c3", Z_TOP - 18, RFA, 2.6, 7, { flangeR: 4.6, thick: 1.6, name: "c3.reflux-nozzle" });
  piece("c3");
  {
    const run = onCol(0, R + 17, RFA);
    const pumpTop = [DIS[0], PY, PZ + 10.6];
    pipe([reflux.port, onCol(Z_TOP - 18, R + 17, RFA), [run[0], run[1], 34], [pumpTop[0], run[1], 34], [pumpTop[0], pumpTop[1], 34], pumpTop], 2.4, { name: "c3.reflux", bend: 3, flangeR: 1.9, free: [false, true], maxLength: 30 });
  }

  // ------------------------------------------------------------ reboiler at the back left
  piece("stand");
  {
    const RB = { y: -86, z: 24, x0: -150, x1: -80, r: 15 };
    const BF = G.frameOf([0, RB.y, RB.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    discAt(BF, RB.x0, RB.x1, RB.r, { tone: "hi" }, { name: "stand.reboiler", inner: Ln(G.arcOf(BF, RB.x0 + 35, RB.r, P), { tone: "faint" }) });
    discAt(BF, RB.x1, RB.x1 + 3, RB.r + 4, { tone: "hi" }, { name: "stand.reboiler-flange", extra: Dots(G.dotsOf(BF, RB.x1 + 3, RB.r + 2, 20, P, { fade: FADE }), { size: 0.4 }) });
    discAt(BF, RB.x1 + 3, RB.x1 + 12, RB.r - 2, { tone: "hi" }, { name: "stand.reboiler-channel" });
    discAt(BF, RB.x0 - 3, RB.x0, RB.r + 4, { tone: "hi" }, { name: "stand.reboiler-rear" });
    for (const x of [RB.x0 + 12, RB.x1 - 12]) {
      const WF = G.frameOf([x, RB.y, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      const half = 10;
      const web = [[-half, 0], [half, 0]];
      for (let i = 0; i <= 16; i++) {
        const y = half - (2 * half * i) / 16;
        web.push([y, RB.z - Math.sqrt(RB.r * RB.r - y * y)]);
      }
      plateAt(WF, web, -1, 1, { name: "stand.reboiler-saddle" });
    }
    // vapor return from the reboiler top into the bottom section
    const host = { ...A.disc(BF, RB.x0, RB.x1, RB.r, { name: "stand.reboiler" }), piece: "stand" };
    const top = (x) => {
      const F = G.frameOf([x, RB.y, RB.z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
      const a = 3.6;
      const id = nameFor("stand.reboiler-nozzle");
      put([x, RB.y, RB.z + RB.r + 2], S(G.saddleOf(F, a, (t) => G.saddleStart(RB.r, a, t), RB.r + 5, P), { tone: "hi" }), { name: id, shapes: [record(A.disc(F, RB.r - 1, RB.r + 5, a, { name: id, seated: true, cut: [host] }))] });
      flangeAt([x, RB.y, RB.z + RB.r + 5.9], [0, 0, 1], 6.4, 1.8, { name: `${id}.flange`, bolts: 6 });
      return [x, RB.y, RB.z + RB.r + 6.8];
    };
    const RA = Math.atan2(RB.y, -40);
    const ret = shellNozzle("c1", 100, Math.atan2(-0.9, -0.43), 3.6, 7, { flangeR: 6.4, thick: 1.8, name: "c1.reboiler-return" });
    piece("stand");
    const from = top(RB.x1 - 18);
    pipe([from, [from[0], from[1], 100], [ret.port[0] + ret.n[0] * 10, ret.port[1] + ret.n[1] * 10, 100], ret.port], 3.6, { name: "stand.reboiler-return", bend: 2.6, flanges: [true, true], flangeR: 1.8 });
    void RA;
  }

  // ------------------------------------------------------------ cleaning skid at the front left
  piece("stand");
  const SKID = { x: -196, y: 40, w: 96, d: 76, r: 2 };
  const SKID_H = 5;
  boxAt(SKID, 0, SKID_H, { tone: "mid" }, {
    name: "stand.skid",
    bevel: 0.8,
    inner: Ln(k.sideSeam(SKID, 2.2, P, 3), { tone: "faint" }),
    extra: Ln(k.planOutline(k.insetPlan(SKID, 3), SKID_H, P, 3), { tone: "lo" }) + Dots(k.dotGrid(SKID.x + 44, SKID.y + 6, 14, 10, 3.4, SKID_H, P), { size: 0.32, tone: "lo" }),
  });
  const TOTE = { x: SKID.x + 6, y: SKID.y + 6, w: 36, d: 36, r: 1 };
  const TANK = { ...k.insetPlan(TOTE, 2.4), r: 4 };
  const TANK_Z = SKID_H + 4;
  const TANK_H = 30;
  const CAGE_TOP = TANK_Z + TANK_H + 1.4;
  boxAt(TOTE, SKID_H, 4, { tone: "lo" }, { name: "stand.tote-pallet", bevel: 0.5 });
  {
    const id = nameFor("stand.tote");
    const tank = k.slabOf(TANK, TANK_Z, TANK_H, P, 6, 0.8);
    const front = TOTE.y + TOTE.d - 1;
    const side = TOTE.x + TOTE.w - 1;
    const bars = [];
    for (let i = 0; i <= 5; i++) {
      const x = TOTE.x + 1 + ((TOTE.w - 2) * i) / 5;
      const y = TOTE.y + 1 + ((TOTE.d - 2) * i) / 5;
      bars.push(k.segment([x, front, TANK_Z], [x, front, CAGE_TOP], P), k.segment([side, y, TANK_Z], [side, y, CAGE_TOP], P));
    }
    const rails = [TANK_Z + 8, TANK_Z + 16, TANK_Z + 24, CAGE_TOP].map((z) => path([[TOTE.x + 1, front, z], [side, front, z], [side, TOTE.y + 1, z]]));
    const topFrame = path([[TOTE.x + 1, TOTE.y + 1, CAGE_TOP], [TOTE.x + 1, front, CAGE_TOP]]) + path([[TOTE.x + 1, TOTE.y + 1, CAGE_TOP], [side, TOTE.y + 1, CAGE_TOP]]);
    const cap = k.cylinder(TANK.x + TANK.w / 2, TANK.y + TANK.d / 2, 4.4, TANK_Z + TANK_H, 2.6, P, 24, 0.4);
    put([TOTE.x + TOTE.w / 2, TOTE.y + TOTE.d / 2, TANK_Z + 16], `<g>${S(tank, { tone: "mid" })}<path class="cd-tote-liquid" data-live="tote-liquid" d=""/><path class="iso-line" data-tone="mid" data-live="tote-level" d=""/>${S(cap, { tone: "mid" })}${Ln(bars.join("") + rails.join("") + topFrame, { tone: "mid" })}</g>`, { name: id, shapes: [record(A.slab(TOTE, TANK_Z, CAGE_TOP - TANK_Z, { name: id }, 3))] });
    live.tote = { plan: k.insetPlan(TANK, 0.6), outer: TANK, z: TANK_Z + 0.6, h: TANK_H - 1.2, steps: 6 };
  }
  // metering pump
  const MP = { x: SKID.x + 48, y: SKID.y + 8, w: 36, d: 20, r: 1 };
  boxAt(MP, SKID_H, 2, { tone: "mid" }, { name: "stand.meter-base", bevel: 0.4 });
  const MZ = SKID_H + 2 + 7;
  const MY = MP.y + MP.d / 2;
  const MMF = G.frameOf([0, MY, MZ], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  for (const x of [MP.x + 7, MP.x + 15]) boxAt({ x: x - 2, y: MY - 4.5, w: 4, d: 9, r: 0.4 }, SKID_H + 2, MZ - 5.5 - SKID_H - 2, { tone: "mid" }, { name: "stand.meter-foot", bevel: 0.2 });
  {
    const id = nameFor("stand.meter-motor");
    put([MP.x + 11, MY, MZ], S(G.disc(MP.x + 4, MP.x + 18, 5.5, MMF, P), { tone: "hi" }) + k.fadedSvg(G.ribsOf(MMF, MP.x + 4, MP.x + 18, 5.5, 18, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }), { name: id, shapes: [record(A.disc(MMF, MP.x + 4, MP.x + 18, 5.5, { name: id }))] });
    discAt(MMF, MP.x + 18, MP.x + 23, 3.2, { tone: "mid" }, { name: "stand.meter-guard" });
    discAt(MMF, MP.x + 23, MP.x + 26, 6.2, { tone: "hi" }, { name: "stand.meter-flange", extra: Dots(G.dotsOf(MMF, MP.x + 26, 5, 8, P, { all: true }), { size: 0.38 }) });
    const head = [[MP.x + 26, 5.6], [MP.x + 29, 5.6], [MP.x + 30.4, 4.8, 1], [MP.x + 31.2, 3.4, 1], [MP.x + 31.6, 2]];
    put([MP.x + 29, MY, MZ], S(G.solidOf(head, MMF, P, { smooth: true }), { tone: "hi" }), { name: "stand.meter-head", shapes: [record(A.solid(MMF, head, { name: "stand.meter-head", curve: head }))] });
  }
  const TOTE_OUT = [TOTE.x + 30, TOTE.y + TOTE.d, TANK_Z + 3.4];
  pipe([TOTE_OUT, [TOTE_OUT[0], TOTE_OUT[1] + 5, TOTE_OUT[2]], [MP.x + 38, TOTE_OUT[1] + 5, TOTE_OUT[2]], [MP.x + 38, MY, TOTE_OUT[2]], [MP.x + 38, MY, MZ], [MP.x + 31.6, MY, MZ]], 1.1, { name: "stand.chem-suction", bend: 3, flangeR: 1.8, tone: "mid" });
  // steam manifold along the skid front with valve, gauge and injection quill, rising to the hose union
  const HY = SKID.y + SKID.d - 8;
  const HZ = 28;
  const MR = 3.2;
  const RISER = [SKID.x - 10, HY];
  boxAt({ x: RISER[0] - 7, y: RISER[1] - 7, w: 14, d: 14, r: 1 }, 0, 2.4, { tone: "lo" }, { name: "stand.steam-plinth", bevel: 0.4 });
  const UNION_X = SKID.x + SKID.w - 6;
  const UNION_Z = 48;
  const manifold = pipe([[RISER[0], RISER[1], 2.4], [RISER[0], RISER[1], HZ], [UNION_X, HY, HZ], [UNION_X, HY, UNION_Z]], MR, { name: "stand.manifold", flangeR: 1.7, touch: ["stand.pipe-stand*", "stand.gauge*", "stand.quill*"], valveAt: (p) => Math.abs(p[0] - (SKID.x + 10)) + Math.abs(p[2] - HZ) * 10 });
  gateValve(manifold, manifold.valve, MR, { name: "stand.steam-valve" });
  for (const x of [SKID.x + 26, SKID.x + SKID.w - 22]) {
    const top = HZ - MR;
    boxAt({ x: x - 5, y: HY - 5, w: 10, d: 10, r: 0.8 }, SKID_H, 1.2, { tone: "mid" }, { name: "stand.pipe-stand-base", bevel: 0.2 });
    boxAt({ x: x - 3, y: HY - 3, w: 6, d: 6, r: 0.6 }, SKID_H + 1.2, top - SKID_H - 1.2 - 1.4, { tone: "mid" }, { name: "stand.pipe-stand" });
    boxAt({ x: x - 4, y: HY - 4, w: 8, d: 8, r: 0.6 }, top - 1.4, 1.4, { tone: "mid" }, { name: "stand.pipe-stand-shoe", bevel: 0.2 });
  }
  const MAN_HOST = { ...A.tube([[RISER[0], HY, HZ], [UNION_X, HY, HZ]], MR, { name: "stand.manifold" }), piece: "stand" };
  {
    const GX = SKID.x + 40;
    const UF = G.frameOf([GX, HY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    put([GX, HY, HZ + MR + 0.5], S(G.saddleOf(UF, 1.4, (a) => HZ + Math.sqrt(Math.max(0, MR * MR - (1.4 * Math.cos(a)) ** 2)), HZ + MR + 1, P), { tone: "mid" }), { name: "stand.gauge-boss", shapes: [record(A.disc(UF, HZ + MR - 0.4, HZ + MR + 1, 1.4, { name: "stand.gauge-boss", seated: true, cut: [MAN_HOST] }))] });
    discAt(UF, HZ + MR + 1, HZ + MR + 6, 0.8, { tone: "mid" }, { name: "stand.gauge-stem" });
    discAt(UF, HZ + MR + 6, HZ + MR + 8, 1.5, { tone: "mid" }, { name: "stand.gauge-socket" });
    const GZ = HZ + MR + 13.6;
    const GF = G.frameOf([GX, HY, GZ], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    const caseR = 5.6;
    put([GX, HY, GZ], S(G.disc(-1.4, 1.6, caseR, GF, P, { bevel: 0.4 }), { tone: "hi" }) + Ln(G.circleOf(GF, 1.6, caseR - 0.9, P), { tone: "mid" }), { name: "stand.gauge-case", shapes: [record(A.disc(GF, -1.4, 1.6, caseR, { name: "stand.gauge-case" }))] });
    const face = 1.62;
    const ticks = [];
    for (let i = 0; i <= 20; i++) {
      const a = (-225 + (270 * i) / 20) * DEG;
      ticks.push(path([G.pointOf(GF, face, i % 5 === 0 ? caseR - 3.2 : caseR - 2.5, a), G.pointOf(GF, face, caseR - 1.6, a)]));
    }
    const arc = path(Array.from({ length: 41 }, (_, i) => G.pointOf(GF, face, caseR - 1.6, (-225 + (270 * i) / 40) * DEG)));
    put([GX, HY + 1.7, GZ], Ln(arc, { tone: "lo" }) + Ln(ticks.join(""), { tone: "mid" }) + `<path class="iso-line" data-tone="lit" data-free="start" data-live="needle" d="" style="stroke-width:1"/>` + Dots([at(G.pointOf(GF, face, 0, 0))], { size: 0.7, tone: "hi" }), { bias: 0.2, name: "stand.gauge-dial", shapes: [record(A.disc(GF, 1.6, 1.7, caseR - 1, { name: "stand.gauge-dial" }))] });
    const o = at(G.pointOf(GF, face, 0, 0));
    const ux = at(G.add3(G.pointOf(GF, face, 0, 0), GF.u));
    const uz = at(G.add3(G.pointOf(GF, face, 0, 0), GF.v));
    live.gauge = { o, u: [ux[0] - o[0], ux[1] - o[1]], v: [uz[0] - o[0], uz[1] - o[1]], r: caseR - 2.1, tail: 1.3, from: -225, span: 270, max: 6 };
  }
  {
    const QX = MP.x + 30;
    const UF = G.frameOf([QX, HY, HZ], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
    put([QX, HY - MR - 1, HZ], S(G.saddleOf(UF, 2.2, (a) => Math.sqrt(Math.max(0, MR * MR - (2.2 * Math.cos(a)) ** 2)), MR + 2.2, P), { tone: "hi" }), { name: "stand.quill-boss", shapes: [record(A.disc(UF, MR - 0.9, MR + 2.2, 2.2, { name: "stand.quill-boss", seated: true, cut: [MAN_HOST] }))] });
    const top = [MP.x + 27.5, MY, MZ + 5.53];
    pipe([top, [top[0], top[1], HZ + 9], [top[0], HY - MR - 8, HZ + 9], [QX, HY - MR - 8, HZ], [QX, HY - MR - 2.2, HZ]], 0.9, { name: "stand.chem-line", bend: 4, flangeR: [1.4, 2.2], tone: "mid" });
  }
  {
    const UF = G.frameOf([UNION_X, HY, UNION_Z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    put([UNION_X, HY, UNION_Z + 1.8], S(G.disc(0, 3.6, MR * 1.7, UF, P, { bevel: 0.3 }), { tone: "hi" }) + k.fadedSvg(G.ribsOf(UF, 0, 3.6, MR * 1.7, 6, P, { fade: [0.1, 0.5] }), { tone: "mid" }), { name: "stand.union", shapes: [record(A.disc(UF, 0, 3.6, MR * 1.7, { name: "stand.union" }))] });
  }
  // steam inlet low on the bottom section, and the braided hose to it
  const SA = VIEW_A + 64 * DEG;
  const inlet = shellNozzle("c1", 68, SA, 4.2, 8, { flangeR: 9.6, thick: 2.4, name: "c1.steam-inlet" });
  piece("stand");
  {
    const F = G.frameOf(inlet.port, inlet.n, tangent(SA), [0, 0, 1]);
    discAt(F, 0, 2.4, 9.6, { tone: "hi" }, { name: "stand.hose-adapter", extra: G.dot3(inlet.n, V) > 0.12 ? Dots(G.dotsOf(F, 2.4, 7.4, 8, P, { all: true }), { size: 0.42 }) : "" });
    discAt(F, 2.4, 7.4, 4.4, { tone: "hi" }, { name: "stand.hose-tail" });
    const end = G.add3(inlet.port, G.mul3(inlet.n, 7.4));
    const route = G.fillet([[UNION_X, HY, UNION_Z + 3.6], [UNION_X, HY, 74], G.add3(end, G.mul3(inlet.n, 20)), end], 14, 16, { P, tube: 2.8 });
    tubeItems(route, 2.8, { name: "stand.hose", tone: "hi", maxLength: 16, spacing: 1, rings: { pitch: 2.4, twist: 1.1, cross: true, fade: [0.1, 0.55], tone: "lo" } });
  }

  // ------------------------------------------------------------ gas board cabinet
  {
    const CAB = { x: 96, y: 40, w: 36, d: 15, r: 0.8 };
    const PL = { x: CAB.x - 3, y: CAB.y - 3, w: CAB.w + 6, d: CAB.d + 6, r: 1 };
    boxAt(PL, 0, 3, { tone: "lo" }, { name: "stand.cabinet-plinth", bevel: 0.4 });
    const top = 52;
    const front = CAB.y + CAB.d;
    const d0 = CAB.x + 1.6;
    const d1 = CAB.x + CAB.w - 1.6;
    const seam = path([[d0, front + 0.05, 4.6], [d1, front + 0.05, 4.6], [d1, front + 0.05, top - 1.6], [d0, front + 0.05, top - 1.6]], true);
    const hinges = [12, 38].map((z) => path([[d0 + 0.2, front + 0.05, z], [d0 + 1.2, front + 0.05, z], [d0 + 1.2, front + 0.05, z + 4], [d0 + 0.2, front + 0.05, z + 4]], true)).join("");
    const SCR = { x0: 3.2, x1: 32.8, z0: 27, z1: 47 };
    const mat = k.sideMatrix([CAB.x, front + 0.06], 0, P, "left");
    const sw = SCR.x1 - SCR.x0;
    const sh = SCR.z1 - SCR.z0;
    const rows = ["phase", "lel", "h2s", "benz", "trays"].map((name, i) => `<text x="${SCR.x0 + 1.4}" y="${-SCR.z1 + 3.4 + i * 3.2}" data-live="scr-${name}"></text>`).join("");
    const screen = `<g transform="${mat}"><clipPath id="cd-screen"><rect x="${SCR.x0}" y="${-SCR.z1}" width="${sw}" height="${sh}" rx="0.8"/></clipPath><rect class="cd-screen" x="${SCR.x0}" y="${-SCR.z1}" width="${sw}" height="${sh}" rx="0.8"/><g clip-path="url(#cd-screen)" class="cd-screen-text">${rows}<rect class="cd-bar-bg" x="${SCR.x0 + 1.4}" y="${-SCR.z0 - 2}" width="${sw - 2.8}" height="0.9"/><rect class="cd-bar" data-live="scr-bar" x="${SCR.x0 + 1.4}" y="${-SCR.z0 - 2}" width="0" height="0.9"/></g><rect class="cd-screen-rim" x="${SCR.x0}" y="${-SCR.z1}" width="${sw}" height="${sh}" rx="0.8"/>${[0, 1, 2].map((i) => `<circle class="cd-lamp" data-live="lamp-${i}" cx="${SCR.x0 + 3 + i * 4}" cy="${-SCR.z0 + 5}" r="1.1"/>`).join("")}</g>`;
    const id = nameFor("stand.cabinet");
    put([CAB.x + CAB.w / 2, CAB.y + CAB.d / 2, 27], S(k.slabOf(CAB, 3, top - 3, P, 2, 0.6), { tone: "hi", inner: Ln(k.sideSeam(CAB, 4.6, P, 2), { tone: "faint" }) }) + Ln(seam, { tone: "lo" }) + Ln(hinges, { tone: "mid" }) + screen, { name: id, shapes: [record(A.slab(CAB, 3, top - 3, { name: id }, 2))] });
    boxAt({ x: CAB.x - 2, y: CAB.y - 1, w: CAB.w + 4, d: CAB.d + 4, r: 0.8 }, top, 1.6, { tone: "mid" }, { name: "stand.cabinet-hood", bevel: 0.4 });
    live.barW = sw - 2.8;
  }

  live.caption =
    "A tray distillation column shut down for a turnaround and decontaminated in place by the vapor-phase method. Steam from the utility station carries cleaning chemistry, metered from the tote, through the braided hose into the bottom section. The vapor climbs tray by tray through the valve decks and downcomers, dissolving the hydrocarbon and sulfide deposit as it goes, and leaves by the overhead line. The air-cooled condenser on the rack condenses it, the reflux drum collects the recovered oil and water, and the pump returns it to the top tray, so the decon runs as a closed loop instead of a steam-out vented to atmosphere. The gas board reads the column's atmosphere against the entry limits (0% LEL, H₂S under 1 ppm, benzene under 0.5 ppm), and only when all three pass do the manways open. The column is built in three flanged sections; take it apart to see the tray stack. Deposit, gas readings and timing come from one illustrative model, not a job record.";
  return live;
}
