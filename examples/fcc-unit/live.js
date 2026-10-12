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
const SHORT = ["RUNNING", "SHUTDOWN", "STEAM IN", "VAPOR DECON", "GAS TEST", "ENTRY OK"];
const bedPath = live("bed");
const bedTop = live("bed-top");
const glowFallback = live("glow");
const board = Object.fromEntries(["rti-bar", "rti-time", "conv-bar", "conv-time", "saved"].map((n) => [n, document.querySelector(`[data-board="${n}"]`)]));

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

// One WebGL pass, three volumes in world space, each seen only through its cut window:
// steam climbing the fractionator (each window shifted with its section when apart),
// steam in the reactor, and the regenerator's fluidized catalyst bed glowing while it runs.
const FRAGMENT = `
uniform float uSteam;
uniform float uFront;
uniform float uLight;
uniform vec2 uRad;
uniform vec2 uAng;
uniform vec4 uWinA;
uniform vec2 uWinB;
uniform vec3 uLift;
uniform vec2 uAng2;
uniform vec2 uRxC;
uniform vec2 uRxR;
uniform vec2 uRxWin;
uniform float uRxSteam;
uniform vec2 uRgC;
uniform vec2 uRgR;
uniform vec2 uRgWin;
uniform float uHeat;
uniform float uBed;
vec2 hits(vec3 p0,vec3 V,vec2 c,float r){
  vec2 q=p0.xy-c;vec2 d=V.xy;
  float a=dot(d,d);float b=2.*dot(q,d);float cc=dot(q,q)-r*r;
  float disc=b*b-4.*a*cc;
  if(disc<=0.)return vec2(1.,-1.);
  float s=sqrt(disc);
  return vec2((-b-s)/(2.*a),(-b+s)/(2.*a));
}
float angleIn(vec3 p,vec2 c,vec2 ang,float r,float px){
  float a=atan(p.y-c.y,p.x-c.x);
  float mid=.5*(ang.x+ang.y);
  float d=a-mid;d=mod(d+3.14159265,6.2831853)-3.14159265;
  float hw=.5*(ang.y-ang.x);
  return window(d,-hw,hw,.7*px/r);
}
float bands(float z,float px,out float rest){
  float m0=window(z,uWinA.x+uLift.x,uWinA.y+uLift.x,.7*px);
  float m1=window(z,uWinA.z+uLift.y,uWinA.w+uLift.y,.7*px);
  float m2=window(z,uWinB.x+uLift.z,uWinB.y+uLift.z,.7*px);
  rest=z-(m0*uLift.x+m1*uLift.y+m2*uLift.z)/max(m0+m1+m2,1e-4);
  return max(m0,max(m1,m2));
}
vec4 steamInk(float amount,float shade,float mask){
  float a=(1.-exp(-amount))*mask;
  vec3 ink=mix(vec3(.72,.76,.81),mix(vec3(.84,.87,.90),vec3(.97,.975,.98),smoothstep(.45,.9,shade)),smoothstep(.1,.6,shade));
  vec4 paper=vec4(ink*a,a);
  vec3 glow=tonemap(vec3(.86,.9,.95)*amount*.75,1.)*mask;
  vec4 night=vec4(glow,max(glow.r,max(glow.g,glow.b)));
  return mix(night,paper,uLight);
}
vec4 column(vec3 p0,vec3 V,float px,float j){
  vec2 ho=hits(p0,V,vec2(0.),uRad.x);vec2 hi=hits(p0,V,vec2(0.),uRad.y);
  if(ho.y<ho.x||hi.y<hi.x||uSteam<.002)return vec4(0.);
  vec3 po=p0+ho.y*V;vec3 pi=p0+hi.y*V;float r0;float r1;
  float mask=angleIn(po,vec2(0.),uAng,uRad.x,px)*angleIn(pi,vec2(0.),uAng,uRad.y,px)*bands(po.z,px,r0)*bands(pi.z,px,r1);
  if(mask<.002)return vec4(0.);
  float dt=(hi.y-hi.x)/14.;float dens=0.;float lit=0.;
  for(int i=0;i<14;i++){
    vec3 p=p0+(hi.x+(float(i)+j)*dt)*V;
    float rz;float inside=bands(p.z,px,rz);
    float n=fbm3(vec3(p.x*.075,p.y*.075,rz*.05-uTime*.42));
    float w=smoothstep(.42,.8,n)*(1.-smoothstep(uFront-14.,uFront+14.,rz))*inside;
    dens+=w*dt;lit+=w*dt*clamp(.6+.4*(p.y-p.x)/uRad.y,0.,1.);
  }
  return steamInk(dens*.07*uSteam,dens>0.?lit/dens:.5,mask);
}
vec4 reactor(vec3 p0,vec3 V,float px,float j){
  vec2 ho=hits(p0,V,uRxC,uRxR.x);vec2 hi=hits(p0,V,uRxC,uRxR.y);
  if(ho.y<ho.x||hi.y<hi.x||uRxSteam<.002)return vec4(0.);
  vec3 po=p0+ho.y*V;vec3 pi=p0+hi.y*V;
  float mask=angleIn(po,uRxC,uAng2,uRxR.x,px)*angleIn(pi,uRxC,uAng2,uRxR.y,px)*window(po.z,uRxWin.x,uRxWin.y,.7*px)*window(pi.z,uRxWin.x,uRxWin.y,.7*px);
  if(mask<.002)return vec4(0.);
  float dt=(hi.y-hi.x)/10.;float dens=0.;
  for(int i=0;i<10;i++){
    vec3 p=p0+(hi.x+(float(i)+j)*dt)*V;
    float n=fbm3(vec3((p.x-uRxC.x)*.09,(p.y-uRxC.y)*.09,p.z*.06-uTime*.5));
    dens+=smoothstep(.42,.8,n)*dt;
  }
  return steamInk(dens*.08*uRxSteam,.7,mask);
}
vec4 regenerator(vec3 p0,vec3 V,float px,float j){
  vec2 ho=hits(p0,V,uRgC,uRgR.x);vec2 hi=hits(p0,V,uRgC,uRgR.y);
  if(ho.y<ho.x||hi.y<hi.x||uHeat<.002)return vec4(0.);
  vec3 po=p0+ho.y*V;vec3 pi=p0+hi.y*V;
  float mask=angleIn(po,uRgC,uAng2,uRgR.x,px)*angleIn(pi,uRgC,uAng2,uRgR.y,px)*window(po.z,uRgWin.x,uRgWin.y,.7*px)*window(pi.z,uRgWin.x,uRgWin.y,.7*px);
  if(mask<.002)return vec4(0.);
  // the dense bed below uBed and the dilute phase above it, bubbling
  float dt=(hi.y-hi.x)/12.;float e=0.;
  for(int i=0;i<12;i++){
    vec3 p=p0+(hi.x+(float(i)+j)*dt)*V;
    float n=fbm3(vec3((p.x-uRgC.x)*.06,(p.y-uRgC.y)*.06,p.z*.05-uTime*.8));
    float dense=1.-smoothstep(uBed-3.,uBed+3.,p.z);
    float dilute=(1.-dense)*exp(-(p.z-uBed)/28.)*.35;
    e+=(dense*(.55+.9*n)+dilute*n)*dt;
  }
  float t=clamp(e*.012*uHeat,0.,1.6);
  vec3 body=vec3(1.,.42,.1)*t+vec3(1.,.82,.45)*max(0.,t-.8);
  vec3 night=tonemap(body,1.3)*mask;
  float a=(1.-exp(-t*1.4))*mask*.92;
  vec3 ink=mix(vec3(.78,.24,.04),vec3(.98,.62,.22),smoothstep(.5,1.2,t));
  vec4 paper=vec4(ink*a,a);
  return mix(vec4(night,max(night.r,max(night.g,night.b))),paper,uLight);
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 V=towardViewer();
  vec3 p0=rayOf(vb);
  float px=pixelOf();
  float j=.5+.35*(hash12(gl_FragCoord.xy)-.5);
  vec4 c=column(p0,V,px,j);
  vec4 r=reactor(p0,V,px,j);
  vec4 g=regenerator(p0,V,px,j);
  vec4 o=c+r*(1.-c.a);o=o+g*(1.-o.a);
  float d=(hash12(gl_FragCoord.xy+17.)-.5)/255.;
  gl_FragColor=vec4(o.rgb+d*step(.002,o.a),o.a);
}`;
const layer = glLayer({
  canvas: stage.querySelector(".cd-gl"),
  fragment: FRAGMENT,
  view: [DATA.W, DATA.H],
  camera: DATA.camera,
  uniforms: ["uSteam", "uFront", "uLift", "uRxSteam", "uHeat", "uBed"],
  fixed: { uLight: LIGHT, uRad: [C.r, C.ri], uAng: C.a, uWinA: [...C.win[0], ...C.win[1]], uWinB: C.win[2], uAng2: DATA.convA, uRxC: DATA.rxWin.c, uRxR: [DATA.rxWin.r, DATA.rxWin.ri], uRxWin: DATA.rxWin.z, uRgC: DATA.regenWin.c, uRgR: [DATA.regenWin.r, DATA.regenWin.ri], uRgWin: DATA.regenWin.z },
});
if (layer) stage.setAttribute("data-gl", "");

const steam = { x: 0, v: 0 };
let p = 0, target = 0, clock = 0, glClock = 0, fanAngle = 0, apart = false, resetting = false;
let touring = !still.matches, visible = false, frame = 0, last = 0, idle = 0;
const TOUR = [[0, 0.05], [3.5, 0.05], [7, 0.26], [8, 0.3], [20, 0.9], [22, 1], [27, 1], [29.5, 0.05]];
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
const TOUR_APART = [23, 26.5];

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
  const lh = Math.max(0.2, T.h * (0.9 - 0.55 * s.decon));
  const B = DATA.bed;
  const bz = B.min + (B.max - B.min) * s.bed;
  const bed = cylinder(B.c[0], B.c[1], B.r, B.z0, bz - B.z0, P, 64);
  bedPath.setAttribute("d", bed.fill);
  bedTop.setAttribute("d", bed.top);
  glowFallback.style.opacity = (0.55 * s.heat).toFixed(3);
  svg.style.setProperty("--rx", s.reactor.toFixed(3));
  const pct = (h) => `${((100 * h) / DATA.board.conventional).toFixed(2)}%`;
  board["rti-bar"].style.width = pct(s.hours);
  board["conv-bar"].style.width = pct(s.conventional);
  board["rti-time"].textContent = s.p >= 0.97 ? `ready at hour ${DATA.board.rti}` : s.hours > 0 ? `hour ${s.hours.toFixed(0)}` : "not started";
  board["conv-time"].textContent = s.hours > 0 ? `hour ${s.conventional.toFixed(0)} of ${DATA.board.conventional}` : "not started";
  board["saved"].textContent = s.p >= 0.97 ? `${DATA.board.conventional - DATA.board.rti} hours sooner` : "";
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
  covers.forEach((cover) => {
    const [ux, uy] = DATA.covers[cover.dataset.cover];
    const d = 9 * s.open;
    cover.setAttribute("transform", d ? `translate(${(ux * d).toFixed(2)} ${(uy * d).toFixed(2)})` : "");
  });
  const ready = entryReady(s);
  const phase = resetting ? "Reset · next turnaround" : phaseOf(s.p);
  scr.phase.textContent = resetting ? "RESET" : SHORT[stepOf(s.p)];
  scr.lel.textContent = `LEL   ${String(Math.round(s.lel)).padStart(4)} %`;
  scr.h2s.textContent = `H2S   ${s.h2s < 10 ? s.h2s.toFixed(1).padStart(4) : String(Math.round(s.h2s)).padStart(4)} ppm`;
  scr.benz.textContent = `C6H6  ${s.benzene < 10 ? s.benzene.toFixed(1).padStart(4) : String(Math.round(s.benzene)).padStart(4)} ppm`;
  scr.trays.textContent = s.hours > 0 ? `HOUR  ${s.hours.toFixed(0).padStart(2)} · ${s.clean}/${DATA.trays} trays` : `TRAYS ${String(s.clean).padStart(2)}/${DATA.trays} clean`;
  scr.bar.setAttribute("width", (DATA.barW * s.decon).toFixed(2));
  lamps[0].dataset.on = s.steam > 0.05 ? "go" : "";
  lamps[1].dataset.on = !ready && s.p > 0.14 ? "warn" : "";
  lamps[2].dataset.on = ready && s.p > 0.5 ? "go" : "";
  const on = resetting ? -1 : stepOf(s.p);
  steps.forEach((button, i) => button.toggleAttribute("data-on", i === on));
  const text = s.p < 0.2 ? `${phase} · regenerator ${Math.round(690 * s.heat + 30 * (1 - s.heat))} °C · LEL ${Math.round(s.lel)}%` : `${phase} · ${s.clean}/${DATA.trays} trays clean · LEL ${Math.round(s.lel)}% · H₂S ${s.h2s < 10 ? s.h2s.toFixed(1) : Math.round(s.h2s)} ppm`;
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
  if (!calm) fanAngle = (fanAngle + dt * 360 * 0.55 * Math.max(steam.x, s.fans)) % 360;
  fans.forEach((fan) => fan.setAttribute("transform", `rotate(${fanAngle.toFixed(1)})`));
  glClock += dt;
  const lift = [springs.c1.x * DATA.pieces.c1[2], springs.c2.x * DATA.pieces.c2[2], springs.c3.x * DATA.pieces.c3[2]];
  const B = DATA.bed;
  const front = s.process > 0.02 ? 900 : 70 + 20 * ((s.decon - 0.18) / 0.5) * (DATA.trays - 1) + 26;
  const colSteam = Math.max(steam.x, 0.32 * s.process);
  const rxSteam = Math.max(steam.x * (0.25 + 0.75 * s.reactor), 0.25 * s.process);
  const active = colSteam > 0.002 || s.heat > 0.002;
  if (layer) active ? layer.draw({ uSteam: colSteam, uFront: front, uLift: lift, uRxSteam: rxSteam, uHeat: s.heat, uBed: B.min + (B.max - B.min) * s.bed }, calm ? 6.3 : glClock) : layer.clear();
  draw(s);
  const busy = touring || p !== target || steaming || moving || ((steam.x > 0.002 || s.heat > 0.002 || s.fans > 0.002) && !calm);
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
    clock = target >= 1 ? 22 : 3.5 + target * 18;
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
// Hover: left to right across the figure runs the decon from shut-down to ready for entry.
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const box = svg.getBoundingClientRect();
  steer(((event.clientX - box.left) / box.width - 0.18) / 0.64);
});
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
  if (event.key >= "1" && event.key <= "6") to = STEP_AT[Number(event.key) - 1];
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
