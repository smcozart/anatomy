// The decontamination model behind every number and moving part of the column figure.
// Pure functions of one value, the progress p (0 = shut down, drained and fouled,
// 1 = clean, gas-free and open), so the build, the page and the readouts agree.

export const TRAYS = 16;
export const LAG = 0.62; // share of the run the vapor front needs to climb from tray 1 to the top
export const STEAM_C = 148; // saturated steam at 3.5 barg
export const LEL_START = 72; // %LEL in the drained column before decon
export const H2S_START = 180; // ppm H2S in the column atmosphere before decon
export const BENZENE_START = 24; // ppm benzene before decon
export const ENTRY = { lel: 0, h2s: 1, benzene: 0.5 }; // the entry limits the gas board tests against
export const DRUM_FILL = 0.74; // reflux drum level at the end of the run

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ease = (x) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};

// Deposit left on tray j (0 = bottom) as a share of the start: the vapor climbs from the bottom.
export const trayDeposit = (j, p) => 1 - ease((p - (LAG * j) / (TRAYS - 1)) / (1 - LAG));

export function state(p) {
  const trays = Array.from({ length: TRAYS }, (_, j) => trayDeposit(j, p));
  const mean = trays.reduce((sum, value) => sum + value, 0) / TRAYS;
  const steam = p <= 0 ? 0 : ease(p / 0.06) * (1 - ease((p - 0.88) / 0.1));
  const open = ease((p - 0.97) / 0.03);
  const gas = mean * mean;
  return {
    p,
    trays,
    clean: trays.filter((value) => value < 0.02).length,
    mean,
    steam,
    open,
    lel: LEL_START * gas,
    h2s: H2S_START * gas,
    benzene: BENZENE_START * gas,
    temp: 24 + (STEAM_C - 24) * steam,
    pressure: 3.5 * steam,
    drum: DRUM_FILL * ease(p),
    fans: steam,
  };
}

export const entryReady = (s) => s.lel <= ENTRY.lel + 0.49 && s.h2s < ENTRY.h2s && s.benzene < ENTRY.benzene;

export function phaseOf(p) {
  if (p <= 0.001) return "Shut down · fouled";
  if (p < 0.06) return "Steam in";
  if (p < 0.88) return "Vapor-phase decon";
  if (p < 0.97) return "Final sweep · gas test";
  return "Ready for entry";
}
