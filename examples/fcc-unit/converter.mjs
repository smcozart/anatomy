// The FCC converter beside the main fractionator: regenerator, reactor and stripper on
// their structure, riser and wye, the two catalyst standpipes with slide valves, the
// flue-gas line and stack, the main air blower, and the big reactor vapor line.
export function converter(ctx, from) {
  const { k, G, A, P, V, at, S, Ln, Dots, path, FADE, record, nameFor, piece, put, tubeItems, discAt, flangeAt, boxAt, ballAt, plateAt, pipe, gateValve, DEG, VIEW_A } = ctx;
  const live = { covers: [], windows: [] };
  piece("stand");
  const RG = { c: [-300, -30], r: 46, ri: 44.6, z0: 30, z1: 226, hd: 23 };
  const RX = { c: [-190, 40], r: 28, ri: 26.6, z0: 240, z1: 330, hd: 14 };
  const ST = { r: 16, z0: 160, z1: 226 };
  const RISER_R = 6;
  const BALL = { r: 10, z: 26 };
  const toRX = G.unit3([RX.c[0] - RG.c[0], RX.c[1] - RG.c[1], 0]);
  const angTo = Math.atan2(toRX[1], toRX[0]);
  const frameAt = ([x, y]) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const RGF = frameAt(RG.c);
  const RXF = frameAt(RX.c);
  const on = (c, z, r, a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), z];
  const radial = (a) => [Math.cos(a), Math.sin(a), 0];
  const tangent = (a) => [-Math.sin(a), Math.cos(a), 0];
  const host = (F, z0, z1, r, name) => ({ ...A.disc(F, z0, z1, r, { name }), piece: "stand", move: [0, 0, 0] });

  // A radial nozzle on a vertical vessel: saddle neck, then a flange.
  function nozzle(c, R, z, a, r, reach, { flangeR = r * 1.7, thick = 2, name, blind = false, hostShape } = {}) {
    const n = radial(a);
    const F = G.frameOf([c[0], c[1], z], n, tangent(a), [0, 0, 1]);
    const id = nameFor(name);
    const start = (ang) => Math.sqrt(Math.max(0, R * R - (r * Math.cos(ang)) ** 2));
    put(on(c, z, R + reach / 2, a), S(G.saddleOf(F, r, start, R + reach, P), { tone: "hi" }), { name: id, shapes: [record(A.disc(F, R - r - 0.5, R + reach, r, { name: id, seated: true, cut: [hostShape] }))] });
    flangeAt(on(c, z, R + reach + thick / 2, a), n, flangeR, thick, { name: `${id}.flange` });
    if (blind) flangeAt(on(c, z, R + reach + thick * 1.5, a), n, flangeR, thick, { name: `${id}.blind` });
    return { port: on(c, z, R + reach + thick * (blind ? 2 : 1), a), n, face: R + reach + thick };
  }
  // A manway on a vertical vessel whose cover pulls open when the unit is gas-free.
  function manway(c, R, z, a, hostShape, name) {
    const noz = nozzle(c, R, z, a, 8.5, 6, { flangeR: 12.5, thick: 2.2, name, hostShape });
    const F = G.frameOf([c[0], c[1], z], noz.n, tangent(a), [0, 0, 1]);
    const s0 = noz.face;
    const s1 = s0 + 2.4;
    const id = nameFor(`${name}-cover`);
    const towards = G.dot3(noz.n, V) > 0;
    const bolts = towards ? Dots(G.dotsOf(F, s1, 10.6, 16, P, { all: true }), { size: 0.45, tone: "mid" }) : "";
    const handle = towards ? Ln(path([G.pointOf(F, s1, 3.5, Math.PI / 2), G.pointOf(F, s1 + 1.6, 3.5, Math.PI / 2), G.pointOf(F, s1 + 1.6, 3.5, -Math.PI / 2), G.pointOf(F, s1, 3.5, -Math.PI / 2)], true), { tone: "mid" }) : "";
    put(on(c, z, (s0 + s1) / 2, a), `<g data-live="cover" data-cover="x${live.covers.length}">${S(G.disc(s0, s1, 12.5, F, P, { bevel: 0.4 }), { tone: "hi" })}${bolts}${handle}</g>`, { bias: 0.1, name: id, shapes: [record(A.disc(F, s0, s1, 12.5, { name: id }))] });
    const o = at(on(c, z, 0, a));
    const e = at(on(c, z, 1, a));
    live.covers.push([e[0] - o[0], e[1] - o[1]]);
  }
  // Ellipsoidal head profile from the tangent line z0, rising (sign 1) or falling (sign -1).
  function headProfile(z0, r, depth, sign, knots = 22) {
    const out = [];
    for (let i = 0; i <= knots; i++) {
      const t = (i / knots) * (Math.PI / 2);
      out.push([z0 + sign * depth * Math.sin(t), Math.max(0.0001, r * Math.cos(t)), i > 0 && i < knots ? 1 : 0]);
    }
    return sign > 0 ? out : out.reverse();
  }
  const headSlope = (z0, r, depth, sign) => (s) => {
    const x = (sign * (s - z0)) / depth;
    if (x <= 0) return 0;
    if (x >= 0.999) return -sign * 60;
    return (-sign * r * x) / (depth * Math.sqrt(1 - x * x));
  };
  const headRadius = (z0, r, depth, sign) => (s) => r * Math.sqrt(Math.max(0, 1 - ((sign * (s - z0)) / depth) ** 2));

  // Window geometry shared by both vessels.
  const WIN_A = [VIEW_A - 44 * DEG, VIEW_A + 44 * DEG];
  const arcRun = (c, z, r, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => on(c, z, r, a0 + ((a1 - a0) * i) / n));
  const riseRun = (c, a, r, z0, z1, n = 6) => Array.from({ length: n + 1 }, (_, i) => on(c, z0 + ((z1 - z0) * i) / n, r, a));
  const windowRing = (c, r, [z0, z1]) => [...arcRun(c, z0, r, WIN_A[0], WIN_A[1]), ...riseRun(c, WIN_A[1], r, z0, z1), ...arcRun(c, z1, r, WIN_A[1], WIN_A[0]), ...riseRun(c, WIN_A[0], r, z1, z0)];
  function wallFacets(c, ri, z0, z1, cls = "") {
    const L = G.lightOf(P);
    const out = [];
    const step = 5 * DEG;
    for (let a = 0; a < 360 * DEG - 1e-9; a += step) {
      const inward = G.mul3(radial(a + step / 2), -1);
      if (G.dot3(inward, V) <= 0) continue;
      out.push(`<path class="iso-shade${cls}" data-shade="${Math.min(3, G.bandOf(G.dot3(inward, L)))}" d="${path([on(c, z0, ri, a), on(c, z1, ri, a), on(c, z1, ri, a + step), on(c, z0, ri, a + step)], true)}"/>`);
    }
    return out.join("");
  }
  function lips(c, R, ri, win) {
    const L = G.lightOf(P);
    const out = [];
    const face = (pts, normal) => {
      if (G.dot3(normal, V) <= 0) return;
      const tone = G.bandOf(G.dot3(normal, L));
      out.push(`<path class="iso-fill" d="${path(pts, true)}"/><path class="${tone === 4 ? "iso-top" : "iso-shade"}" data-shade="${tone}" d="${path(pts, true)}"/>`);
    };
    face([...arcRun(c, win[0], R, WIN_A[0], WIN_A[1]), ...arcRun(c, win[0], ri, WIN_A[1], WIN_A[0])], [0, 0, 1]);
    face([...riseRun(c, WIN_A[0], R, win[0], win[1]), ...riseRun(c, WIN_A[0], ri, win[1], win[0])], tangent(WIN_A[0]));
    face([...riseRun(c, WIN_A[1], R, win[0], win[1]), ...riseRun(c, WIN_A[1], ri, win[1], win[0])], G.mul3(tangent(WIN_A[1]), -1));
    return out.join("") + Ln(path(windowRing(c, ri, win), true), { tone: "mid" }) + Ln(path(windowRing(c, R, win), true), { tone: "hi" });
  }
  function cyclone(c, top, bottom, r, dipTo) {
    const F = frameAt(c);
    const body = [[bottom + 12, 0.0001], [bottom + 12, 2], [bottom + 22, r, 0], [top, r], [top, 0.0001]];
    const paths = G.lathe(body, F, P, { steps: 32 });
    const dip = G.disc(dipTo, bottom + 12, 1.8, F, P);
    const outlet = G.disc(top, top + 14, 3, F, P);
    return S(dip, { tone: "mid" }) + S(paths, { tone: "hi", inner: Ln(G.arcOf(F, bottom + 22, r, P) + G.arcOf(F, top - 8, r, P), { tone: "faint" }) }) + S(outlet, { tone: "mid" });
  }

  // ------------------------------------------------------------ regenerator
  {
    // skirt and base ring on an octagon plinth
    const OCT = Array.from({ length: 8 }, (_, i) => {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      return [RG.c[0] + Math.cos(a) * 64, RG.c[1] + Math.sin(a) * 64];
    });
    const pid = nameFor("stand.regen-plinth");
    put([RG.c[0], RG.c[1], 3], S(k.extrude(OCT, 0, 6.8, P, { bevel: 0.8 }), { tone: "lo" }), { name: pid, shapes: [record(A.extruded(OCT, 0, 6.8, { name: pid }))] });
    discAt(RGF, 6.8, 8, RG.r + 6, { tone: "mid" }, { name: "stand.regen-base-ring" });
    discAt(RGF, 8, RG.z0, RG.r, { tone: "hi" }, { name: "stand.regen-skirt", rims: "first" });
    const win = [52, 196];
    const shellHost = host(RGF, RG.z0, RG.z1, RG.r, "stand.regen-shell");
    const cuts = [RG.z0, win[0] - 2, win[1] + 2, RG.z1];
    const skip = [[200, 202], [214, 216]];
    for (let b = 0; b < 3; b++) {
      const id = nameFor("stand.regen-shell");
      let extra = "";
      if (b === 1) {
        const bedClip = `<clipPath id="fc-rg-o"><path d="${path(windowRing(RG.c, RG.r, win), true)}"/></clipPath><clipPath id="fc-rg-i"><path d="${path(windowRing(RG.c, RG.ri, win), true)}"/></clipPath>`;
        const cyc = [-60, 60].map((d) => {
          const a = angTo + 180 * DEG + d * DEG;
          return cyclone([RG.c[0] + 22 * Math.cos(a), RG.c[1] + 22 * Math.sin(a)], 210, 150, 8, 70);
        });
        const grid = Ln(G.circleOf(RGF, 44, RG.ri - 6, P) + G.circleOf(RGF, 44, RG.ri - 16, P), { tone: "mid" });
        extra = `${bedClip}<g clip-path="url(#fc-rg-o)"><g clip-path="url(#fc-rg-i)"><g class="cd-cavity"><path class="cd-void" d="${path(windowRing(RG.c, RG.r, win), true)}"/>${wallFacets(RG.c, RG.ri, win[0] - 30, win[1] + 30)}</g>${grid}<path class="fc-bed" data-live="bed" d=""/><path class="fc-bed-top" data-live="bed-top" d=""/>${cyc.join("")}<path class="fc-glow" data-live="glow" d="${path(windowRing(RG.c, RG.ri, win), true)}"/></g></g>${lips(RG.c, RG.r, RG.ri, win)}`;
        live.bed = { c: RG.c, r: RG.ri - 0.2, z0: 44, max: 118, min: 46 };
        live.regenWin = { c: RG.c, r: RG.r, ri: RG.ri, z: win };
      }
      const [z0, z1] = [cuts[b], cuts[b + 1]];
      if (b === 1) live.windows.push({ name: id, ring: windowRing(RG.c, RG.ri, win).map((q) => at(q)) });
      const parts = b === 2 ? [[z0, skip[0][0]], [skip[0][1], skip[1][0]], [skip[1][1], z1]] : [[z0, z1]];
      parts.forEach(([a0, a1], pi) => {
        const pid = pi ? nameFor("stand.regen-shell") : id;
        put([RG.c[0], RG.c[1], (a0 + a1) / 2], S(G.disc(a0, a1, RG.r, RGF, P, { rims: "none" }), { tone: "hi", inner: b === 0 ? Ln(G.arcOf(RGF, RG.z0, RG.r, P), { tone: "faint" }) : "" }) + (pi ? "" : extra), { name: pid, shapes: [record(A.disc(RGF, a0, a1, RG.r, { name: pid }))] });
      });
    }
    const prof = headProfile(RG.z1, RG.r, RG.hd, 1);
    live.regenHead = ctx.turned(RGF, prof, { tone: "hi" }, { name: "stand.regen-head", smooth: { slope: headSlope(RG.z1, RG.r, RG.hd, 1), radius: headRadius(RG.z1, RG.r, RG.hd, 1) }, inner: Ln(G.arcOf(RGF, RG.z1, RG.r, P), { tone: "faint" }) });
    // refractory bands and a ring of shell bolts are hidden; the shell gets stiffener rings
    for (const z of [200, 214]) {
      const id = nameFor("stand.regen-stiffener");
      put([RG.c[0], RG.c[1], z + 1], S(G.ringBand(z, z + 2, RG.r, RG.r + 1.6, RGF, P), { tone: "mid" }), { name: id, shapes: [record(A.ring(RGF, z, z + 2, RG.r, RG.r + 1.6, { name: id }))] });
    }
    manway(RG.c, RG.r, 72, VIEW_A + 70 * DEG, shellHost, "stand.regen-manway");
    // flue gas from the crown to the stack
    const crown = RG.z1 + RG.hd;
    const atCrown = (rho) => RG.z1 + RG.hd * Math.sqrt(Math.max(0, 1 - (rho / RG.r) ** 2));
    {
      const id = nameFor("stand.regen-flue-neck");
      const s0 = atCrown(10) - 0.05;
      put([RG.c[0], RG.c[1], (s0 + crown + 8) / 2], S(G.disc(s0, crown + 8, 10, RGF, P, { rims: "last" }), { tone: "hi" }), { name: id, shapes: [record(A.disc(RGF, s0, crown + 8, 10, { name: id, seated: true, cut: [live.regenHead] }))] });
    }
    flangeAt([RG.c[0], RG.c[1], crown + 9.3], [0, 0, 1], 16, 2.6, { name: "stand.regen-flue-flange" });
    const STACK = { c: [RG.c[0], RG.c[1] - 140], r: 13, h: 420 };
    const SF = frameAt(STACK.c);
    discAt(SF, 0, 3, STACK.r + 8, { tone: "lo" }, { name: "stand.stack-base" });
    const sz = crown + 30;
    const stackHost = host(SF, 3, STACK.h, STACK.r, "stand.stack");
    discAt(SF, 3, STACK.h, STACK.r, { tone: "hi" }, { name: "stand.stack", inner: Ln([80, 160, 240, 320, 400].map((z) => G.arcOf(SF, z, STACK.r, P)).join(""), { tone: "faint" }) });
    discAt(SF, STACK.h, STACK.h + 3, STACK.r + 1.6, { tone: "mid" }, { name: "stand.stack-lip" });
    const sn = nozzle(STACK.c, STACK.r, sz, Math.PI / 2, 8, 6, { flangeR: 16, thick: 2.6, name: "stand.stack-inlet", hostShape: stackHost });
    pipe([[RG.c[0], RG.c[1], crown + 10.6], [RG.c[0], RG.c[1], sz], sn.port], 8, { name: "stand.flue", bend: 2.4, flangeR: 2 });
    // air from the main air blower into the bottom
    const airA = VIEW_A + 115 * DEG;
    const air = nozzle(RG.c, RG.r, 40, airA, 7, 7, { flangeR: 12.6, thick: 2.2, name: "stand.regen-air", hostShape: shellHost });
    const BL = { x: RG.c[0] - 120, y: RG.c[1] + 70 };
    const BLF = G.frameOf([0, BL.y, 22], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    boxAt({ x: BL.x - 30, y: BL.y - 16, w: 70, d: 32, r: 1 }, 0, 4, { tone: "lo" }, { name: "stand.blower-plinth", bevel: 0.5 });
    for (const x of [BL.x - 20, BL.x - 4]) boxAt({ x: x - 3, y: BL.y - 9, w: 6, d: 18, r: 0.5 }, 4, 22 - 11 - 4, { tone: "mid" }, { name: "stand.blower-foot", bevel: 0.2 });
    put([BL.x - 12, BL.y, 22], S(G.disc(BL.x - 26, BL.x + 2, 11, BLF, P), { tone: "hi" }) + k.fadedSvg(G.ribsOf(BLF, BL.x - 26, BL.x + 2, 11, 28, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }), { name: "stand.blower-motor", shapes: [record(A.disc(BLF, BL.x - 26, BL.x + 2, 11, { name: "stand.blower-motor" }))] });
    discAt(BLF, BL.x + 2, BL.x + 8, 5, { tone: "mid" }, { name: "stand.blower-coupling" });
    const vol = [[BL.x + 8, 15], [BL.x + 26, 15], [BL.x + 30, 12, 1], [BL.x + 32, 8, 1], [BL.x + 33, 4]];
    boxAt({ x: BL.x + 8, y: BL.y - 16, w: 22, d: 32, r: 0.6 }, 4, 3, { tone: "mid" }, { name: "stand.blower-pedestal", bevel: 0.3 });
    put([BL.x + 20, BL.y, 22], S(G.solidOf(vol, BLF, P, { smooth: true }), { tone: "hi" }), { name: "stand.blower-casing", shapes: [record(A.solid(BLF, vol, { name: "stand.blower-casing", curve: vol }))] });
    const blowOut = [BL.x + 18, BL.y, 22 + 15];
    {
      const F = G.frameOf([blowOut[0], BL.y, 22], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
      const a = 7;
      put([blowOut[0], BL.y, 22 + 17], S(G.saddleOf(F, a, (t) => G.saddleStart(15, a, t), 21, P), { tone: "hi" }), { name: "stand.blower-outlet", shapes: [record(A.disc(F, 13, 21, a, { name: "stand.blower-outlet", seated: true, cut: [{ ...A.disc(BLF, BL.x + 8, BL.x + 26, 15, { name: "stand.blower-casing" }), piece: "stand", move: [0, 0, 0] }] }))] });
      flangeAt([blowOut[0], BL.y, 22 + 22.1], [0, 0, 1], 12.6, 2.2, { name: "stand.blower-flange" });
    }
    pipe([[blowOut[0], BL.y, 22 + 23.2], [blowOut[0], BL.y, 70], [air.port[0] + air.n[0] * 22, air.port[1] + air.n[1] * 22, 70], [air.port[0] + air.n[0] * 22, air.port[1] + air.n[1] * 22, 40], air.port], 7, { name: "stand.air", bend: 2.4, flangeR: 1.8 });
    live.regenHost = shellHost;
  }

  // ------------------------------------------------------------ reactor structure, reactor, stripper, riser
  const half = 40;
  const COLS = [[-half, -half], [half, -half], [-half, half], [half, half]].map(([dx, dy]) => [RX.c[0] + dx, RX.c[1] + dy]);
  const BEAM_Z = 236;
  for (const [x, y] of COLS) {
    boxAt({ x: x - 6, y: y - 6, w: 12, d: 12, r: 0.6 }, 0, 2.4, { tone: "lo" }, { name: "stand.rx-footing", bevel: 0.3 });
    boxAt({ x: x - 3, y: y - 3, w: 6, d: 6, r: 0.3 }, 2.4, BEAM_Z - 2.4, { tone: "mid" }, { name: "stand.rx-column", bevel: 0.3 });
  }
  for (const z of [196, BEAM_Z]) {
    const h = z === BEAM_Z ? 6 : 3;
    boxAt({ x: RX.c[0] - half + 3, y: RX.c[1] - half - 2.5, w: 2 * half - 6, d: 5, r: 0.3 }, z, h, { tone: "mid" }, { name: "stand.rx-beam", bevel: 0.3 });
    boxAt({ x: RX.c[0] - half + 3, y: RX.c[1] + half - 2.5, w: 2 * half - 6, d: 5, r: 0.3 }, z, h, { tone: "mid" }, { name: "stand.rx-beam", bevel: 0.3 });
    boxAt({ x: RX.c[0] - half - 2.5, y: RX.c[1] - half + 3, w: 5, d: 2 * half - 6, r: 0.3 }, z, h, { tone: "mid" }, { name: "stand.rx-beam", bevel: 0.3 });
    boxAt({ x: RX.c[0] + half - 2.5, y: RX.c[1] - half + 3, w: 5, d: 2 * half - 6, r: 0.3 }, z, h, { tone: "mid" }, { name: "stand.rx-beam", bevel: 0.3 });
  }
  const TOP = BEAM_Z + 6;
  // support ring welded to the reactor, resting on the top beams
  {
    const id = nameFor("stand.rx-support-ring");
    put([RX.c[0], RX.c[1], TOP + 2], S(G.ringBand(TOP, TOP + 4, RX.r, half + 2.5, RXF, P), { tone: "mid" }), { name: id, shapes: [record(A.ring(RXF, TOP, TOP + 4, RX.r, half + 2.5, { name: id }))] });
  }
  const RZ0 = TOP + 4;
  // reactor shell with a window onto the riser termination and cyclones
  const rxWin = [RZ0 + 10, RX.z1 - 6];
  const rxHost = host(RXF, RZ0, RX.z1, RX.r, "stand.rx-shell");
  {
    const cuts = [RZ0, rxWin[0] - 2, rxWin[1] + 2, RX.z1];
    for (let b = 0; b < 3; b++) {
      const id = nameFor("stand.rx-shell");
      let extra = "";
      if (b === 1) {
        const cyc = [-55, 55].map((d) => {
          const a = VIEW_A + 180 * DEG + d * DEG;
          return cyclone([RX.c[0] + 15 * Math.cos(a), RX.c[1] + 15 * Math.sin(a)], RX.z1 - 4, RZ0 + 18, 6, RZ0 + 4);
        });
        const term = S(G.disc(RZ0 - 2, RZ0 + 34, RISER_R, RXF, P), { tone: "hi" }) + S(G.disc(RZ0 + 34, RZ0 + 38, RISER_R + 3, RXF, P), { tone: "mid" });
        extra = `<clipPath id="fc-rx-o"><path d="${path(windowRing(RX.c, RX.r, rxWin), true)}"/></clipPath><clipPath id="fc-rx-i"><path d="${path(windowRing(RX.c, RX.ri, rxWin), true)}"/></clipPath><g clip-path="url(#fc-rx-o)"><g clip-path="url(#fc-rx-i)"><g class="cd-cavity"><path class="cd-void" d="${path(windowRing(RX.c, RX.r, rxWin), true)}"/>${wallFacets(RX.c, RX.ri, rxWin[0] - 20, rxWin[1] + 20)}</g><path class="cd-dep fc-coke" d="${path(windowRing(RX.c, RX.ri + 0.1, [rxWin[0] - 20, rxWin[1] + 20]), true)}"/>${term}${cyc.join("")}<path class="cd-haze" data-live="haze" d="${path(windowRing(RX.c, RX.ri, rxWin), true)}"/></g></g>${lips(RX.c, RX.r, RX.ri, rxWin)}`;
        live.rxWin = { c: RX.c, r: RX.r, ri: RX.ri, z: rxWin };
      }
      const [z0, z1] = [cuts[b], cuts[b + 1]];
      if (b === 1) live.windows.push({ name: id, ring: windowRing(RX.c, RX.ri, rxWin).map((q) => at(q)) });
      put([RX.c[0], RX.c[1], (z0 + z1) / 2], S(G.disc(z0, z1, RX.r, RXF, P, { rims: b === 0 ? "first" : "none" }), { tone: "hi" }) + extra, { name: id, shapes: [record(A.disc(RXF, z0, z1, RX.r, { name: id }))] });
    }
    const prof = headProfile(RX.z1, RX.r, RX.hd, 1);
    live.rxHead = ctx.turned(RXF, prof, { tone: "hi" }, { name: "stand.rx-head", smooth: { slope: headSlope(RX.z1, RX.r, RX.hd, 1), radius: headRadius(RX.z1, RX.r, RX.hd, 1) }, inner: Ln(G.arcOf(RXF, RX.z1, RX.r, P), { tone: "faint" }) });
  }
  // cone under the shell down to the stripper, the stripper, and its bottom cone to the riser
  {
    const cone = [[ST.z1, ST.r], [TOP, RX.r]];
    ctx.turned(RXF, [[ST.z1, ST.r], ...cone.slice(1)], { tone: "hi" }, { name: "stand.rx-cone" });
    discAt(RXF, ST.z0, ST.z1, ST.r, { tone: "hi" }, { name: "stand.stripper", rims: "none", inner: Ln(G.arcOf(RXF, ST.z0 + 30, ST.r, P), { tone: "faint" }) });
    ctx.turned(RXF, [[ST.z0 - 12, RISER_R + 0.6], [ST.z0, ST.r]], { tone: "hi" }, { name: "stand.stripper-cone" });
  }
  manway(RX.c, RX.r, rxWin[0] + 26, VIEW_A - 74 * DEG, rxHost, "stand.rx-manway");
  // riser from the wye to the stripper bottom, with expansion bands
  const WYE = [RX.c[0], RX.c[1], BALL.z];
  ballAt(WYE, BALL.r, { tone: "hi", name: "stand.wye" });
  const WYE_SHAPE = { ...A.ball(WYE, BALL.r, { name: "stand.wye" }), piece: "stand", move: [0, 0, 0] };
  boxAt({ x: WYE[0] - 6, y: WYE[1] - 6, w: 12, d: 12, r: 0.6 }, 0, BALL.z - BALL.r + 0.1, { tone: "lo" }, { name: "stand.wye-pedestal", bevel: 0.3 });
  const riserFrom = BALL.z + Math.sqrt(BALL.r ** 2 - RISER_R ** 2);
  {
    const id = nameFor("stand.riser");
    const s0 = riserFrom - 0.05;
    [[s0, 69], [71, 109], [111, ST.z0 - 12]].forEach(([a0, a1], i) => {
      const pid = i ? nameFor("stand.riser") : id;
      put([RX.c[0], RX.c[1], (a0 + a1) / 2], S(G.disc(a0, a1, RISER_R, RXF, P, { rims: "none" }), { tone: "hi" }), { name: pid, shapes: [record(A.disc(RXF, a0, a1, RISER_R, i ? { name: pid } : { name: pid, seated: true, cut: [WYE_SHAPE] }))] });
    });
  }
  for (const z of [70, 110]) {
    const id = nameFor("stand.riser-band");
    put([RX.c[0], RX.c[1], z], S(G.ringBand(z - 1, z + 1, RISER_R, RISER_R + 1.4, RXF, P), { tone: "mid" }), { name: id, shapes: [record(A.ring(RXF, z - 1, z + 1, RISER_R, RISER_R + 1.4, { name: id }))] });
  }
  // lift-steam nozzle on the wye, toward the cleaning skid
  const liftA = Math.atan2(from.union[1] - WYE[1], from.union[0] - WYE[0]);
  const lift = (() => {
    const n = radial(liftA);
    const F = G.frameOf(WYE, n, tangent(liftA), [0, 0, 1]);
    const r = 3.4;
    const s0 = Math.sqrt(BALL.r ** 2 - r ** 2);
    put(G.add3(WYE, G.mul3(n, (s0 + BALL.r + 6) / 2)), S(G.disc(s0, BALL.r + 6, r, F, P), { tone: "hi" }), { name: "stand.lift-steam", shapes: [record(A.disc(F, s0, BALL.r + 6, r, { name: "stand.lift-steam", seated: true, cut: [WYE_SHAPE] }))] });
    flangeAt(G.add3(WYE, G.mul3(n, BALL.r + 7)), n, 7, 2, { name: "stand.lift-steam-flange" });
    return { port: G.add3(WYE, G.mul3(n, BALL.r + 8)), n };
  })();
  {
    const F = G.frameOf(lift.port, lift.n, tangent(liftA), [0, 0, 1]);
    discAt(F, 0, 4, 4.2, { tone: "hi" }, { name: "stand.hose-tail" });
    const end = G.add3(lift.port, G.mul3(lift.n, 4));
    const route = G.fillet([from.union, [from.union[0], from.union[1], 64], G.add3(end, G.add3(G.mul3(lift.n, 24), [0, 0, 22])), G.add3(end, G.mul3(lift.n, 10)), end], 12, 16, { P, tube: 2.8 });
    tubeItems(route, 2.8, { name: "stand.hose", tone: "hi", maxLength: 16, spacing: 1, rings: { pitch: 2.4, twist: 1.1, cross: true, fade: [0.1, 0.55], tone: "lo" } });
  }

  // ------------------------------------------------------------ catalyst standpipes with slide valves
  function slideValve(line, along, r, name) {
    const centre = G.pointAlong(line, along);
    const tangentV = G.tangentAlong(line, along);
    const F = G.frameAlong(centre, tangentV);
    const id = nameFor(name);
    put(centre, S(G.disc(-r * 1.4, r * 1.4, r * 1.9, F, P, { bevel: 0.4 }), { tone: "hi" }) + Dots([...G.dotsOf(F, -r * 1.4, r * 1.6, 10, P, { fade: FADE }), ...G.dotsOf(F, r * 1.4, r * 1.6, 10, P, { fade: FADE })], { size: 0.38 }), { name: id, shapes: [record(A.disc(F, -r * 1.4, r * 1.4, r * 1.9, { name: id, owner: line.owner }))] });
    const side = G.unit3(G.cross3(tangentV, [0, 0, 1]));
    const out = G.dot3(side, V) > 0 ? side : G.mul3(side, -1);
    const AF = G.frameAlong(centre, out);
    discAt(AF, r * 1.9 - 0.4, r * 1.9 + 4, r * 0.7, { tone: "mid" }, { name: `${id}.bonnet`, owner: line.owner });
    discAt(AF, r * 1.9 + 4, r * 1.9 + 16, r * 0.9, { tone: "hi" }, { name: `${id}.actuator`, owner: line.owner, inner: Ln(G.arcOf(AF, r * 1.9 + 10, r * 0.9, P), { tone: "faint" }) });
    discAt(AF, r * 1.9 + 16, r * 1.9 + 18, r * 1.1, { tone: "mid" }, { name: `${id}.cap`, owner: line.owner });
    return [along - r * 1.4, along + r * 1.4];
  }
  const standR = 5;
  // regenerated catalyst: regenerator bottom to the wye
  {
    const a = angTo + 7 * DEG;
    const noz = nozzle(RG.c, RG.r, 96, a, standR, 7, { flangeR: 9.5, thick: 2.2, name: "stand.regen-cat-out", hostShape: live.regenHost });
    const knee = G.add3(noz.port, G.mul3(noz.n, 10));
    const back = G.unit3([knee[0] - WYE[0], knee[1] - WYE[1], 0]);
    const low = [WYE[0] + back[0] * 24, WYE[1] + back[1] * 24, BALL.z + 6];
    const u = G.unit3(G.sub3(low, WYE));
    const end = G.add3(WYE, G.mul3(u, Math.sqrt(BALL.r ** 2 - standR ** 2)));
    const control = [noz.port, knee, low, end];
    const line = G.fillet(control, standR * 2.6, 12, { P, tube: standR });
    const total = G.pathLength(line);
    const at45 = total * 0.13;
    const valve = [at45 - standR * 1.4, at45 + standR * 1.4];
    const l2 = pipe(control, standR, { name: "stand.regen-standpipe", bend: 2.6, flanges: [true, false], flangeR: 1.9, gaps: [valve], caps: [true, false] });
    slideValve(l2, at45, standR, "stand.regen-slide-valve");
  }
  // spent catalyst: stripper side down into the regenerator
  {
    const a = angTo + 180 * DEG + 14 * DEG;
    const sNoz = nozzle(RX.c, ST.r, 176, a, standR, 6, { flangeR: 9.5, thick: 2.2, name: "stand.stripper-cat-out", hostShape: host(RXF, ST.z0, ST.z1, ST.r, "stand.stripper") });
    const rA = angTo + 16 * DEG;
    const rNoz = nozzle(RG.c, RG.r, 122, rA, standR, 6, { flangeR: 9.5, thick: 2.2, name: "stand.regen-cat-in", hostShape: live.regenHost });
    const control = [sNoz.port, G.add3(sNoz.port, G.mul3(sNoz.n, 9)), G.add3(rNoz.port, G.mul3(rNoz.n, 9)), rNoz.port];
    const line = G.fillet(control, standR * 2.6, 12, { P, tube: standR });
    const total = G.pathLength(line);
    const valve = [total * 0.5 - standR * 1.4, total * 0.5 + standR * 1.4];
    const l2 = pipe(control, standR, { name: "stand.spent-standpipe", bend: 2.6, flangeR: 1.9, gaps: [valve] });
    slideValve(l2, total * 0.5, standR, "stand.spent-slide-valve");
  }

  // ------------------------------------------------------------ reactor vapor line to the fractionator
  {
    const crown = RX.z1 + RX.hd;
    const atCrown = (rho) => RX.z1 + RX.hd * Math.sqrt(Math.max(0, 1 - (rho / RX.r) ** 2));
    {
      const id = nameFor("stand.rx-vapor-neck");
      const s0 = atCrown(9) - 0.05;
      put([RX.c[0], RX.c[1], (s0 + crown + 8) / 2], S(G.disc(s0, crown + 8, 9, RXF, P, { rims: "last" }), { tone: "hi" }), { name: id, shapes: [record(A.disc(RXF, s0, crown + 8, 9, { name: id, seated: true, cut: [live.rxHead] }))] });
    }
    flangeAt([RX.c[0], RX.c[1], crown + 9.3], [0, 0, 1], 15, 2.6, { name: "stand.rx-vapor-flange" });
    const inlet = from.vaporInlet;
    const away = G.add3(inlet.port, G.mul3(inlet.n, 44));
    const route = [[RX.c[0], RX.c[1], crown + 10.6], [RX.c[0], RX.c[1], 372], [away[0], away[1], 372], away, inlet.port];
    pipe(route, 9, { name: "stand.vapor-line", bend: 2.4, flangeR: 15 / 9, maxLength: 30 });
  }

  live.converter = { rg: RG, rx: RX, regenCyclones: true };
  return live;
}
