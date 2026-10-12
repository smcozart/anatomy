const DATA = __DATA__;
const stage = document.querySelector(".cd-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const live = (name) => svg.querySelector(`[data-live="${name}"]`);
const all = (name) => [...svg.querySelectorAll(`[data-live="${name}"]`)];
const P = DATA.P;
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIGHT = document.body.dataset.theme === "light" ? 1 : 0;
const C = DATA.col;

const toteLiquid = live("tote-liquid");
const toteLevel = live("tote-level");
const needle = live("needle");
const drumLiquid = live("drum-liquid");
const hazes = all("haze");
const covers = all("cover");
const fans = all("fan");
const scr = Object.fromEntries(["phase", "lel", "h2s", "benz", "trays", "bar"].map((n) => [n, live(`scr-${n}`)]));
const lamps = [0, 1, 2].map((i) => live(`lamp-${i}`));
const steps = [...document.querySelectorAll(".cd-step")];
const apartButton = document.querySelector("[data-apart]");
const STEP_AT = [0, 0.03, 0.5, 0.93, 1];
const stepOf = (v) => (v <= 0.001 ? 0 : v < 0.06 ? 1 : v < 0.88 ? 2 : v < 0.97 ? 3 : 4);
const SHORT = ["SHUT DOWN", "STEAM IN", "VAPOR DECON", "GAS TEST", "ENTRY OK"];

// Pieces that come apart: every drawn item carries its piece; each piece rides its own spring.
const itemsLayer = svg.querySelector(".cd-items");
const groups = {};
const nodes = [...itemsLayer.children].map((el) => {
  const m = el.dataset.m.split(",").map(Number);
  return { el, piece: el.dataset.piece, key: Number(el.dataset.k), lift: m[0] * DATA.V[0] + m[1] * DATA.V[1] + m[2] * DATA.V[2] };
});
for (const node of nodes) (groups[node.piece] ??= []).push(node.el);
let order = nodes.map((_, i) => i);
// Settled keys plus each piece's lift keep every overlap in true depth order as the column comes apart.
function resort() {
  const keyOf = (n) => n.key + n.lift * springs[n.piece].x;
  const next = nodes.map((_, i) => i).sort((a, b) => keyOf(nodes[a]) - keyOf(nodes[b]));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    itemsLayer.appendChild(fragment);
    order = next;
  }
}
const springs = Object.fromEntries(Object.keys(DATA.pieces).map((id) => [id, { x: 0, v: 0, target: 0, wait: 0 }]));

// Steam carrying the chemistry, climbing the column: marched through the inner cylinder in
// world space, shown only through the three cut windows (each shifted with its section).
const FRAGMENT = `
uniform float uSteam;
uniform float uFront;
uniform float uLight;
uniform vec2 uRad;
uniform vec2 uAng;
uniform vec4 uWinA;
uniform vec2 uWinB;
uniform vec3 uLift;
vec2 hits(vec3 p0,vec3 V,float r){
  vec2 q=p0.xy;vec2 d=V.xy;
  float a=dot(d,d);float b=2.*dot(q,d);float c=dot(q,q)-r*r;
  float disc=b*b-4.*a*c;
  if(disc<=0.)return vec2(1.,-1.);
  float s=sqrt(disc);
  return vec2((-b-s)/(2.*a),(-b+s)/(2.*a));
}
float angleIn(vec3 p,float r,float px){
  float ang=atan(p.y,p.x);
  float mid=.5*(uAng.x+uAng.y);
  float d=ang-mid;d=mod(d+3.14159265,6.2831853)-3.14159265;
  float hw=.5*(uAng.y-uAng.x);
  return window(d,-hw,hw,.7*px/r);
}
float bands(float z,float px,out float rest){
  float m0=window(z,uWinA.x+uLift.x,uWinA.y+uLift.x,.7*px);
  float m1=window(z,uWinA.z+uLift.y,uWinA.w+uLift.y,.7*px);
  float m2=window(z,uWinB.x+uLift.z,uWinB.y+uLift.z,.7*px);
  rest=z-(m0*uLift.x+m1*uLift.y+m2*uLift.z)/max(m0+m1+m2,1e-4);
  return max(m0,max(m1,m2));
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 V=towardViewer();
  vec3 p0=rayOf(vb);
  float px=pixelOf();
  vec2 ho=hits(p0,V,uRad.x);
  vec2 hi=hits(p0,V,uRad.y);
  if(ho.y<ho.x||hi.y<hi.x||uSteam<.002){gl_FragColor=vec4(0.);return;}
  vec3 po=p0+ho.y*V;vec3 pi=p0+hi.y*V;
  float r0;float r1;
  float mask=angleIn(po,uRad.x,px)*angleIn(pi,uRad.y,px)*bands(po.z,px,r0)*bands(pi.z,px,r1);
  if(mask<.002){gl_FragColor=vec4(0.);return;}
  float dt=(hi.y-hi.x)/16.;
  float j=.5+.35*(hash12(gl_FragCoord.xy)-.5);
  float dens=0.;float lit=0.;
  for(int i=0;i<16;i++){
    float t=hi.x+(float(i)+j)*dt;
    vec3 p=p0+t*V;
    float rz;float inside=bands(p.z,px,rz);
    vec3 q=vec3(p.x*.075,p.y*.075,rz*.05-uTime*.42);
    float n=fbm3(q);
    float puff=smoothstep(.42,.8,n);
    float below=1.-smoothstep(uFront-14.,uFront+14.,rz);
    float w=puff*below*inside;
    dens+=w*dt;
    lit+=w*dt*clamp(.5+.5*dot(normalize(vec3(p.xy,0.)+1e-4),vec3(-.5,.5,0.))+.2,0.,1.);
  }
  float amount=dens*.07*uSteam;
  float a=(1.-exp(-amount))*mask;
  float shade=dens>0.?lit/dens:.5;
  vec3 ink=mix(vec3(.72,.76,.81),mix(vec3(.84,.87,.90),vec3(.97,.975,.98),smoothstep(.45,.9,shade)),smoothstep(.1,.6,shade));
  float d=(hash12(gl_FragCoord.xy+17.)-.5)/255.;
  vec4 paper=vec4(ink*a+d,a);
  vec3 glow=tonemap(vec3(.86,.9,.95)*amount*.75,1.)*mask;
  vec4 night=vec4(glow+d,max(glow.r,max(glow.g,glow.b)));
  gl_FragColor=mix(night,paper,uLight);
}`;
const layer = glLayer({
  canvas: stage.querySelector(".cd-gl"),
  fragment: FRAGMENT,
  view: [DATA.W, DATA.H],
  camera: DATA.camera,
  uniforms: ["uSteam", "uFront", "uLift"],
  fixed: { uLight: LIGHT, uRad: [C.r, C.ri], uAng: C.a, uWinA: [...C.win[0], ...C.win[1]], uWinB: C.win[2] },
});
if (layer) stage.setAttribute("data-gl", "");

const steam = { x: 0, v: 0 };
let p = 0, target = 0, clock = 0, glClock = 0, fanAngle = 0, apart = false, resetting = false;
let touring = !still.matches, visible = false, frame = 0, last = 0, idle = 0;
const TOUR = [[0, 0], [2.5, 0], [17, 1], [19, 1], [22.5, 1], [24.5, 0]];
const tourAt = (t) => {
  const c = t % TOUR[TOUR.length - 1][0];
  for (let i = 1; i < TOUR.length; i++)
    if (c <= TOUR[i][0]) {
      const [t0, v0] = TOUR[i - 1];
      const [t1, v1] = TOUR[i];
      return v0 + (v1 - v0) * ((c - t0) / (t1 - t0));
    }
  return 0;
};
const TOUR_APART = [19, 22.5];

function setApart(next) {
  if (next === apart) return;
  apart = next;
  apartButton.setAttribute("aria-pressed", String(apart));
  apartButton.textContent = apart ? "Put the column back" : "Take the column apart";
  // the leading piece leaves first and comes back last
  const order = apart ? DATA.stagger : [...DATA.stagger].reverse();
  order.forEach((id, i) => {
    springs[id].target = apart ? 1 : 0;
    springs[id].wait = i * DATA.spring.stagger;
  });
}

function drawPieces(dt, calm) {
  let moving = false;
  for (const [id, s] of Object.entries(springs)) {
    if (s.wait > 0) {
      s.wait -= dt;
      moving = true;
      continue;
    }
    if (calm) {
      s.x = s.target;
      s.v = 0;
    } else {
      const { stiffness, damping, substeps } = DATA.spring;
      for (let i = 0; i < substeps; i++) {
        s.v += ((s.target - s.x) * stiffness - s.v * damping) * (dt / substeps);
        s.x += s.v * (dt / substeps);
      }
      if (Math.abs(s.target - s.x) < 1e-4 && Math.abs(s.v) < 1e-4) {
        s.x = s.target;
        s.v = 0;
      } else moving = true;
    }
    const [mx, my] = DATA.screenMove[id];
    const t = s.x ? `translate(${(mx * s.x).toFixed(2)} ${(my * s.x).toFixed(2)})` : "";
    if (s.last !== t) {
      for (const g of groups[id] ?? []) t ? g.setAttribute("transform", t) : g.removeAttribute("transform");
      s.last = t;
    }
  }
  resort();
  return moving;
}

function draw(s) {
  const T = DATA.tote;
  const lh = Math.max(0.2, T.h * (0.9 - 0.55 * Math.min(1, s.p / 0.85)));
  toteLiquid.setAttribute("d", slabOf(T.plan, T.z, lh, P, T.steps).fill);
  toteLevel.setAttribute("d", sideSeam(T.outer, T.z + lh, P, T.steps));
  const g = DATA.gauge;
  const a = ((g.from + g.span * Math.min(1, s.pressure / g.max)) * Math.PI) / 180;
  const pt = (r) => [g.o[0] + r * (Math.cos(a) * g.u[0] + Math.sin(a) * g.v[0]), g.o[1] + r * (Math.cos(a) * g.u[1] + Math.sin(a) * g.v[1])];
  const [t0, t1] = [pt(-g.tail), pt(g.r)];
  needle.setAttribute("d", `M${t0[0].toFixed(2)} ${t0[1].toFixed(2)}L${t1[0].toFixed(2)} ${t1[1].toFixed(2)}`);
  const dh = DATA.drum.h * s.drum;
  drumLiquid.setAttribute("y", (-1 - dh).toFixed(2));
  drumLiquid.setAttribute("height", dh.toFixed(2));
  for (let j = 0; j < DATA.trays; j++) svg.style.setProperty(`--t${j}`, s.trays[j].toFixed(3));
  hazes.forEach((h) => (h.style.opacity = (0.3 * steam.x).toFixed(3)));
  covers.forEach((cover, i) => {
    const [ux, uy] = DATA.covers[i];
    const d = 9 * s.open;
    cover.setAttribute("transform", d ? `translate(${(ux * d).toFixed(2)} ${(uy * d).toFixed(2)})` : "");
  });
  const ready = entryReady(s);
  const phase = resetting ? "Reset · next turnaround" : phaseOf(s.p);
  scr.phase.textContent = resetting ? "RESET" : SHORT[stepOf(s.p)];
  scr.lel.textContent = `LEL   ${String(Math.round(s.lel)).padStart(4)} %`;
  scr.h2s.textContent = `H2S   ${s.h2s < 10 ? s.h2s.toFixed(1).padStart(4) : String(Math.round(s.h2s)).padStart(4)} ppm`;
  scr.benz.textContent = `C6H6  ${s.benzene < 10 ? s.benzene.toFixed(1).padStart(4) : String(Math.round(s.benzene)).padStart(4)} ppm`;
  scr.trays.textContent = `TRAYS ${String(s.clean).padStart(2)}/${DATA.trays} clean`;
  scr.bar.setAttribute("width", (DATA.barW * s.p).toFixed(2));
  lamps[0].dataset.on = s.steam > 0.05 ? "go" : "";
  lamps[1].dataset.on = !ready && s.p > 0.001 ? "warn" : "";
  lamps[2].dataset.on = ready && s.p > 0.5 ? "go" : "";
  const on = resetting ? -1 : stepOf(s.p);
  steps.forEach((button, i) => button.toggleAttribute("data-on", i === on));
  const text = `${phase} · ${s.clean}/${DATA.trays} trays clean · LEL ${Math.round(s.lel)}% · H₂S ${s.h2s < 10 ? s.h2s.toFixed(1) : Math.round(s.h2s)} ppm`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(s.p * 100)));
  stage.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    target = tourAt(clock);
    const c = clock % TOUR[TOUR.length - 1][0];
    setApart(c > TOUR_APART[0] && c < TOUR_APART[1]);
  }
  p = calm ? target : p + (target - p) * (1 - Math.exp(-dt / 0.3));
  if (Math.abs(target - p) < 1e-4) p = target;
  const s = state(p);
  resetting = touring && clock % TOUR[TOUR.length - 1][0] > TOUR[TOUR.length - 2][0] && p < 1;
  const steaming = settle(steam, resetting ? 0 : s.steam, dt, 0.6, calm);
  const moving = drawPieces(dt, calm);
  if (!calm) fanAngle = (fanAngle + dt * 360 * 0.55 * steam.x) % 360;
  fans.forEach((fan) => fan.setAttribute("transform", `rotate(${fanAngle.toFixed(1)})`));
  glClock += dt;
  const lift = [springs.c1.x * DATA.pieces.c1[2], springs.c2.x * DATA.pieces.c2[2], springs.c3.x * DATA.pieces.c3[2]];
  const front = C.z0 + 12 + (C.z1 - C.z0) * Math.min(1.2, s.p / 0.62);
  if (layer) steam.x > 0.002 ? layer.draw({ uSteam: steam.x, uFront: front, uLift: lift }, calm ? 6.3 : glClock) : layer.clear();
  draw(s);
  const busy = touring || p !== target || steaming || moving || (steam.x > 0.002 && !calm);
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const hold = () => {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => {
    touring = !still.matches;
    clock = target >= 1 ? 17 : 2.5 + target * 14.5;
    run();
  }, 9000);
};
const steer = (next) => {
  hold();
  target = Math.min(1, Math.max(0, next));
  run();
};
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
steps.forEach((button, i) => button.addEventListener("click", () => steer(STEP_AT[i])));
apartButton.addEventListener("click", () => {
  hold();
  setApart(!apart);
  run();
});
stage.addEventListener("keydown", (event) => {
  let to = null;
  const here = STEP_AT.reduce((best, stop, i) => (Math.abs(stop - target) < Math.abs(STEP_AT[best] - target) ? i : best), 0);
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = STEP_AT[Math.min(STEP_AT.length - 1, here + 1)];
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = STEP_AT[Math.max(0, here - 1)];
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = 1;
  if (event.key >= "1" && event.key <= "5") to = STEP_AT[Number(event.key) - 1];
  if (event.key === "a" || event.key === "A") {
    event.preventDefault();
    hold();
    setApart(!apart);
    run();
    return;
  }
  if (event.key === "Escape") {
    hold();
    setApart(false);
    run();
    return;
  }
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
draw(state(0));
