// The turnaround model behind every number and moving part of the FCC figure. Pure
// functions of one value, the progress p through the turnaround:
//   0.00-0.14  running: catalyst circulating, regenerator bed glowing
//   0.14-0.26  shutdown: feed out, bed cools, catalyst withdrawn
//   0.26-0.32  steam in at the riser
//   0.32-0.90  vapor-phase decon of the reactor, vapor line and main fractionator
//   0.90-0.97  final sweep and gas test
//   0.97-1.00  ready for entry, manways open
// Hours and the conventional comparison are illustrative.

export const TRAYS = 16;
export const LEL_START = 72;
export const H2S_START = 180;
export const BENZENE_START = 24;
export const ENTRY = { lel: 0, h2s: 1, benzene: 0.5 };
export const DRUM_FILL = 0.74;
export const DECON_HOURS = 36; // vapor-phase decon, steam in to ready for entry
export const CONVENTIONAL_HOURS = 140; // steam-out, water wash, re-steam and re-test
export const PHASES = [0, 0.14, 0.26, 0.32, 0.9, 0.97, 1];

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ease = (x) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
const span = (p, a, b) => clamp((p - a) / (b - a));

// Decon progress q (0..1) from steam-in to the end of the sweep.
export const deconOf = (p) => span(p, 0.26, 0.9);
// The vapor reaches the reactor first, then the line, then climbs the fractionator.
export const reactorDeposit = (p) => 1 - ease((deconOf(p) - 0.04) / 0.32);
export const trayDeposit = (j, p) => 1 - ease((deconOf(p) - 0.18 - (0.5 * j) / (TRAYS - 1)) / 0.32);

export function state(p) {
  const trays = Array.from({ length: TRAYS }, (_, j) => trayDeposit(j, p));
  const reactor = reactorDeposit(p);
  const mean = (trays.reduce((sum, value) => sum + value, 0) + reactor * 4) / (TRAYS + 4);
  const running = 1 - ease(span(p, 0.12, 0.2));
  const heat = 1 - ease(span(p, 0.12, 0.24));
  const bed = 1 - ease(span(p, 0.16, 0.26));
  const steam = ease(span(p, 0.26, 0.31)) * (1 - ease(span(p, 0.88, 0.96)));
  const open = ease(span(p, 0.97, 1));
  const gas = mean * mean;
  const decon = deconOf(p);
  const hours = p < 0.26 ? 0 : p >= 0.97 ? DECON_HOURS : DECON_HOURS * span(p, 0.26, 0.97);
  return {
    p,
    trays,
    reactor,
    clean: trays.filter((value) => value < 0.02).length,
    mean,
    running,
    heat,
    bed,
    steam,
    process: running,
    open,
    decon,
    lel: p < 0.2 ? LEL_START : LEL_START * gas,
    h2s: p < 0.2 ? H2S_START : H2S_START * gas,
    benzene: p < 0.2 ? BENZENE_START : BENZENE_START * gas,
    pressure: 3.5 * steam,
    drum: 0.3 + (DRUM_FILL - 0.3) * ease(decon),
    fans: Math.max(running, steam),
    hours,
    conventional: Math.min(CONVENTIONAL_HOURS, hours),
  };
}

export const entryReady = (s) => s.p > 0.5 && s.lel <= ENTRY.lel + 0.49 && s.h2s < ENTRY.h2s && s.benzene < ENTRY.benzene;

export const STEPS = ["Running", "Shutdown", "Steam in", "Vapor-phase decon", "Gas test", "Ready for entry"];
export const STEP_AT = [0.05, 0.22, 0.3, 0.62, 0.94, 1];
export function stepOf(p) {
  if (p < 0.14) return 0;
  if (p < 0.26) return 1;
  if (p < 0.32) return 2;
  if (p < 0.9) return 3;
  if (p < 0.97) return 4;
  return 5;
}
export const phaseOf = (p) => STEPS[stepOf(p)];
