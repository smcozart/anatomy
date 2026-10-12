const DATA = __DATA__;
const stage = document.querySelector(".hx-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const live = (name) => svg.querySelector(`[data-live="${name}"]`);
const toteLiquid = live("tote-liquid");
const toteLevel = live("tote-level");
const needle = live("needle");
const drumLiquid = live("drum-liquid");
const haze = live("haze");
const scrPhase = live("scr-phase"), scrLel = live("scr-lel"), scrU = live("scr-u"), scrBar = live("scr-bar");
const lamps = [0, 1, 2].map((i) => live(`lamp-${i}`));
const BAR_W = Number(scrBar.previousElementSibling.getAttribute("width"));
const SHORT = { "Isolated · fouled": "ISOLATED", "Steam in": "STEAM IN", "Vapor-phase clean": "VAPOR PHASE", "Final sweep": "FINAL SWEEP", "Clean · gas-free": "GAS-FREE" };
const P = DATA.P;
const steps = [...document.querySelectorAll(".hx-step")];
const STEP_AT = [0, 0.05, 0.5, 0.95, 1];
const stepOf = (v) => (v <= 0.001 ? 0 : v < 0.1 ? 1 : v < 0.9 ? 2 : v < 0.999 ? 3 : 4);
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIGHT = document.body.dataset.theme === "light" ? 1 : 0;
const S = DATA.shell;

// Vapor inside the shell: steam carrying dissolved hydrocarbon, drifting from the inlet
// (left) to the outlet (right). Marched through the shell's inner cylinder in world space
// and masked by the cut window on the outer and the inner surface.
const FRAGMENT = `
uniform float uSteam;
uniform float uLight;
uniform vec2 uAxis;
uniform vec2 uRad;
uniform vec4 uWin;
uniform vec2 uLen;
vec2 hits(vec3 p0,vec3 V,float r){
  vec2 q=p0.yz-uAxis;vec2 d=V.yz;
  float a=dot(d,d);float b=2.*dot(q,d);float c=dot(q,q)-r*r;
  float disc=b*b-4.*a*c;
  if(disc<=0.)return vec2(1.,-1.);
  float s=sqrt(disc);
  return vec2((-b-s)/(2.*a),(-b+s)/(2.*a));
}
float opening(vec3 p,float r,float px){
  float ang=atan(p.z-uAxis.y,p.y-uAxis.x);
  return window(p.x,uWin.x,uWin.y,.7*px)*window(ang,uWin.z,uWin.w,.7*px/r);
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 V=towardViewer();
  vec3 p0=rayOf(vb);
  float px=pixelOf();
  vec2 ho=hits(p0,V,uRad.x);
  vec2 hi=hits(p0,V,uRad.y);
  if(ho.y<ho.x||hi.y<hi.x||uSteam<.002){gl_FragColor=vec4(0.);return;}
  float mask=opening(p0+ho.y*V,uRad.x,px)*opening(p0+hi.y*V,uRad.y,px);
  if(mask<.002){gl_FragColor=vec4(0.);return;}
  float dt=(hi.y-hi.x)/16.;
  float j=.5+.35*(hash12(gl_FragCoord.xy)-.5);
  float dens=0.;float lit=0.;
  for(int i=0;i<16;i++){
    float t=hi.x+(float(i)+j)*dt;
    vec3 p=p0+t*V;
    vec3 q=vec3(p.x*.07-uTime*.5,p.y*.085,p.z*.085+uTime*.05);
    float n=fbm3(q);
    float puff=smoothstep(.42,.78,n);
    float along=clamp((p.x-uLen.x)/(uLen.y-uLen.x),0.,1.);
    float w=puff*(.65+.35*along);
    dens+=w*dt;
    lit+=w*dt*clamp(.55+.6*(p.z-uAxis.y)/uRad.y,0.,1.);
  }
  float amount=dens*.075*uSteam;
  float a=(1.-exp(-amount))*mask;
  float shade=dens>0.?lit/dens:.5;
  vec3 crown=vec3(.97,.975,.98);
  vec3 edge=vec3(.84,.87,.90);
  vec3 under=vec3(.72,.76,.81);
  vec3 ink=mix(under,mix(edge,crown,smoothstep(.45,.9,shade)),smoothstep(.1,.6,shade));
  float d=(hash12(gl_FragCoord.xy+17.)-.5)/255.;
  vec4 paper=vec4(ink*a+d,a);
  vec3 glow=tonemap(vec3(.86,.9,.95)*amount*.75,1.)*mask;
  vec4 night=vec4(glow+d,max(glow.r,max(glow.g,glow.b)));
  gl_FragColor=mix(night,paper,uLight);
}`;
const layer = glLayer({
  canvas: stage.querySelector(".hx-gl"),
  fragment: FRAGMENT,
  view: [DATA.W, DATA.H],
  camera: DATA.camera,
  uniforms: ["uSteam"],
  fixed: { uLight: LIGHT, uAxis: [S.y, S.z], uRad: [S.r, S.ri], uWin: S.win, uLen: [S.x0, S.x1] },
});
if (layer) stage.setAttribute("data-gl", "");

const steam = { x: 0, v: 0 };
let resetting = false, p = 0, target = 0, clock = 0, glClock = 0, touring = !still.matches, visible = false, frame = 0, last = 0, idle = 0;
// The tour: hold fouled, run the clean, hold clean, then put the fouling back for the next loop.
const TOUR = [[0, 0], [2.5, 0], [15, 1], [19.5, 1], [21.5, 0]];
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

function draw(s) {
  const T = DATA.tote;
  const lh = Math.max(0.2, T.h * s.tote);
  toteLiquid.setAttribute("d", slabOf(T.plan, T.z, lh, P, T.steps).fill);
  toteLevel.setAttribute("d", sideSeam(T.outer, T.z + lh, P, T.steps));
  const g = DATA.gauge;
  const a = ((g.from + g.span * Math.min(1, s.pressure / g.max)) * Math.PI) / 180;
  const pt = (r) => [g.o[0] + r * (Math.cos(a) * g.u[0] + Math.sin(a) * g.v[0]), g.o[1] + r * (Math.cos(a) * g.u[1] + Math.sin(a) * g.v[1])];
  const [t0, t1] = [pt(-g.tail), pt(g.r)];
  needle.setAttribute("d", `M${t0[0].toFixed(2)} ${t0[1].toFixed(2)}L${t1[0].toFixed(2)} ${t1[1].toFixed(2)}`);
  const dh = DATA.drum.h * s.drum;
  drumLiquid.setAttribute("y", (-dh).toFixed(2));
  drumLiquid.setAttribute("height", dh.toFixed(2));
  DATA.spans.forEach((xi, i) => svg.style.setProperty(`--d${i}`, depositAt(xi, p).toFixed(3)));
  haze.style.opacity = (0.32 * steam.x).toFixed(3);
  scrPhase.textContent = resetting ? "RESET" : SHORT[phaseOf(p)];
  scrLel.textContent = `LEL  ${String(Math.round(s.lel)).padStart(3)}%`;
  scrU.textContent = `U    ${String(Math.round(s.u * 100)).padStart(3)}%`;
  scrBar.setAttribute("width", (BAR_W * p).toFixed(2));
  lamps[0].dataset.on = s.steam > 0.05 ? "go" : "";
  lamps[1].dataset.on = p > 0.001 && p < 0.999 ? "warn" : "";
  lamps[2].dataset.on = p >= 0.999 ? "go" : "";
  const phase = resetting ? "Reset · next exchanger" : phaseOf(p);
  const on = resetting ? -1 : stepOf(p);
  steps.forEach((button, i) => button.toggleAttribute("data-on", i === on));
  const text = `${phase} · deposit ${s.deposit.toFixed(2)} mm · U ${Math.round(s.u * 100)}% · LEL ${Math.round(s.lel)}%`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(p * 100)));
  stage.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    target = tourAt(clock);
  }
  p = calm ? target : p + (target - p) * (1 - Math.exp(-dt / 0.3));
  if (Math.abs(target - p) < 1e-4) p = target;
  const s = state(p);
  resetting = touring && clock % TOUR[TOUR.length - 1][0] > TOUR[TOUR.length - 2][0] && p < 1;
  const moving = settle(steam, resetting ? 0 : s.steam, dt, 0.6, calm);
  glClock += dt;
  if (layer) steam.x > 0.002 ? layer.draw({ uSteam: steam.x }, calm ? 4.2 : glClock) : layer.clear();
  draw(s);
  const busy = touring || p !== target || moving || (steam.x > 0.002 && !calm);
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const steer = (next) => {
  touring = false;
  target = Math.min(1, Math.max(0, next));
  clearTimeout(idle);
  idle = setTimeout(() => {
    touring = !still.matches;
    clock = target >= 1 ? 15 : 2.5 + target * 12.5;
    run();
  }, 6000);
  run();
};
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  steer(((event.clientX - box.left) / box.width - 0.18) / 0.64);
});
const STOPS = [0, 0.05, 0.35, 0.65, 0.95, 1];
stage.addEventListener("keydown", (event) => {
  let to = null;
  const here = STOPS.reduce((best, stop, i) => (Math.abs(stop - target) < Math.abs(STOPS[best] - target) ? i : best), 0);
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = STOPS[Math.min(STOPS.length - 1, here + 1)];
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = STOPS[Math.max(0, here - 1)];
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = 1;
  if (event.key >= "1" && event.key <= "5") to = STEP_AT[Number(event.key) - 1];
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
steps.forEach((button, i) => button.addEventListener("click", () => steer(STEP_AT[i])));
draw(state(0));
