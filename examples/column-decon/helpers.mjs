// Drawing helpers shared by the column figure: every helper puts its item into one
// recorder with its true shape, so the audit can settle the painter's order and prove it.
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import * as A from "../../kit/audit.mjs";

export function makeKit(P, { pieces, order = [], spring = {} }) {
  const V = G.viewOf(P);
  const KS = G.scaleOf(P);
  const at = (point) => k.iso(point, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (points, style) => k.dotsSvg(points, style);
  const path = (points, closed = false) => k.pathOf(points.map((p) => at(p)), closed);
  const FADE = [0.04, 0.42];
  const R = A.recorder(P, { order, spring });
  const record = R.solid;
  const nameFor = R.nameFor;
  let current = "stand";
  const piece = (name) => (current = name);
  const moveOf = (name) => pieces[name].move;

  function put(at3, svg, { bias = 0, shapes = [], name = nameFor(`${current}.item`), p = current } = {}) {
    R.put({ piece: p, at: at3, bias, svg, shapes, name, move: moveOf(p) });
  }
  function tubeItems(route, r, { name, tone = "hi", bias = 0, maxLength = 26, spacing, owner, limp = false, gaps = [], caps = true, rims, rings, free = [false, false], touch, breaks = [] } = {}) {
    const id = nameFor(name ?? `${current}.tube`);
    R.route(id, route, r, { owner: owner ?? id, limp, gaps, rims, free, touch, piece: current, move: moveOf(current) });
    tubePieces(route, r, P, { maxLength, spacing, gaps, caps, rings, breaks }).forEach((part, index) =>
      put(part.mid, tubeSvg(part, { tone }), { bias, name: `${id}:${index}`, shapes: [A.tube(part.points, part.radii)] }),
    );
    return id;
  }
  function turned(F, profile, style = {}, { extra = "", inner = "", bias = 0, rims, bevel = 0, steps, name, owner, smooth } = {}) {
    const soft = smooth ?? profile.some((point) => point[2]);
    const paths = G.solidOf(profile, F, P, { bevel, smooth: soft, ...(rims ? { rims } : {}), ...(steps ? { steps } : {}) });
    const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
    const id = nameFor(name ?? `${current}.turned`);
    const shape = record(A.solid(F, profile, { name: id, owner, curve: soft && !(smooth && smooth.slope) ? profile : undefined }));
    put(G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "hi", ...style, inner }) + extra, { bias, name: id, shapes: [shape] });
    return shape;
  }
  function discAt(F, s0, s1, r, style = {}, { extra = "", inner = "", bias = 0, name, owner, rims, bevel = 0 } = {}) {
    const id = nameFor(name ?? `${current}.disc`);
    const shape = record(A.disc(F, s0, s1, r, { name: id, owner }));
    put(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P, { bevel, ...(rims ? { rims } : {}) }), { tone: "hi", ...style, inner }) + extra, { bias, name: id, shapes: [shape] });
    return shape;
  }
  function flangeAt(centre, axis, r, thick, { bolts = 8, tone = "hi", bias = 0, boltR, name, owner, size = 0.42 } = {}) {
    const F = G.frameAlong(centre, axis);
    const id = nameFor(name ?? `${current}.flange`);
    const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
    const face = Math.abs(G.dot3(F.a, V)) > 0.12 && bolts ? Dots(G.dotsOf(F, towards, boltR ?? r * 0.76, bolts, P, { all: true }), { size, tone: "mid" }) : "";
    const rim = bolts && Math.abs(G.dot3(F.a, V)) < 0.97 ? Ln(G.arcOf(F, 0, r, P), { tone: "faint" }) : "";
    put(centre, S(G.disc(-thick / 2, thick / 2, r, F, P), { tone, inner: rim }) + face, { bias, name: id, shapes: [record(A.disc(F, -thick / 2, thick / 2, r, { name: id, owner }))] });
    return id;
  }
  function boxAt(plan, z, h, style = {}, { extra = "", bias = 0, bevel = 0.5, steps = 3, name, owner, inner = "" } = {}) {
    const centre = [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
    const id = nameFor(name ?? `${current}.box`);
    put(centre, S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "hi", ...style, inner }) + extra, { bias, name: id, shapes: [record(A.slab(plan, z, h, { name: id, owner }, steps))] });
    return id;
  }
  function ballAt(centre, r, { tone = "mid", bias = 0, name, owner } = {}) {
    const id = nameFor(name ?? `${current}.ball`);
    put(centre, S(G.sphereOf(centre, r, P, { steps: G.stepsFor(r, 32) }), { tone }), { bias, name: id, shapes: [record(A.ball(centre, r, { name: id, owner }))] });
  }

  // A plate of any outline (concave too) in a frame's u, v plane, thick along F.a.
  function plateSvg(F, poly, s0, s1, tone = "mid") {
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
    faces.push({ pts: ring.map((p) => pt(capS, p)), tone: G.bandOf(G.dot3(capN, L)) });
    const fills = faces.map(({ pts }) => `<path class="iso-fill" d="${path(pts, true)}"/>`).join("");
    const shades = faces.map(({ pts, tone: t }) => (t === 4 ? `<path class="iso-top" d="${path(pts, true)}"/>` : `<path class="iso-shade" data-shade="${t}" d="${path(pts, true)}"/>`)).join("");
    const edges = faces.map(({ pts }) => path(pts, true)).join("");
    return `<g class="iso-solid">${fills}${shades}<path class="iso-line iso-edge" data-tone="${tone}" d="${edges}"/></g>`;
  }
  function plateAt(F, poly, s0, s1, { tone = "mid", name, owner, extra = "", bias = 0 } = {}) {
    const id = nameFor(name ?? `${current}.plate`);
    const c = poly.reduce((sum, [x, y]) => [sum[0] + x / poly.length, sum[1] + y / poly.length], [0, 0]);
    const centre = G.add3(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), G.add3(G.mul3(F.u, c[0]), G.mul3(F.v, c[1])));
    put(centre, plateSvg(F, poly, s0, s1, tone) + extra, { bias, name: id, shapes: [record(A.prism(F, poly, s0, s1, { name: id, owner }))] });
    return id;
  }

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
  function pipe(control, r, { bend = 2.6, tone = "hi", flanges = [true, true], flangeR = 1.6, bands = [], maxLength = 22, name, gaps: extra = [], rings, caps, touch, valveAt, free, breaks } = {}) {
    const line = G.fillet(control, Math.max(r * bend, 3), r > 3 ? 18 : 12, { P, tube: r });
    const total = G.pathLength(line);
    const fr = (i) => r * [flangeR].flat()[Math.min(i, [flangeR].flat().length - 1)];
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
      collars.push({ kind: "flange", centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: fr(index), thick, gap: sign < 0 ? [0, thick] : [total - thick, total] });
    });
    for (const share of bands) {
      const along = share > 1 ? share : total * share;
      const thick = Math.max(0.9, r * 0.6);
      collars.push({ kind: "band", centre: G.pointAlong(line, along), tangent: G.tangentAlong(line, along), radius: r * 1.22, thick, gap: [along - thick / 2, along + thick / 2] });
    }
    const gaps = [...collars.map(({ gap }) => gap), ...extra];
    const owner = tubeItems(line, r, { name: name ?? `${current}.pipe`, tone, maxLength, spacing: Math.max(0.8, Math.min(2.4, r * 0.18)), gaps, rings, caps, touch, free, breaks, rims: flanges.map((on, i) => (on ? fr(i) : r)) });
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
    const faces = [-half, half].filter(() => Math.abs(G.dot3(F.a, V)) > 0.12).map((s) => Dots(G.dotsOf(F, s, r * 1.22, 6, P, { all: true }), { size: 0.38, tone: "mid" })).join("");
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
      shapes: [
        record(A.ring(UF, w0, w1, wheelR - 0.9, wheelR, { name: `${id}.wheel`, owner: line.owner })),
        record(A.disc(UF, w0, w1 + 0.2, 1.1, { name: `${id}.hub`, owner: line.owner })),
        ...[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          const d = [Math.cos(a), Math.sin(a), 0];
          const mid = (wheelR - 0.9 + 1.1) / 2;
          return record(A.orientedBox(G.add3(centre, [d[0] * mid, d[1] * mid, (w0 + w1) / 2]), [d, [-d[1], d[0], 0], [0, 0, 1]], [(wheelR - 0.9 - 1.1) / 2 + 0.2, 0.3, (w1 - w0) / 2], { name: `${id}.spoke`, owner: line.owner }));
        }),
      ],
    });
    return id;
  }

  return { k, G, A, P, V, KS, at, S, Ln, Dots, path, FADE, R, record, nameFor, piece, moveOf, put, tubeItems, turned, discAt, flangeAt, boxAt, ballAt, plateSvg, plateAt, alongAt, pipe, gateValve };
}
