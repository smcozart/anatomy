// The cleaning model behind every number and every moving part in the figure.
// Pure functions of one value, the cleaning progress p (0 = isolated and fouled,
// 1 = clean and gas-free), so the build, the live page and the readout agree.

export const DEPOSIT_MM = 1.0; // hydrocarbon deposit on the tubes before cleaning
export const K_DEPOSIT = 0.35; // W/m·K, asphaltene and coke-like hydrocarbon deposit
export const U_CLEAN = 300; // W/m²·K, a clean oil-to-oil exchanger
export const STATIONS = [0, 0.2, 0.4, 0.6, 0.8, 1]; // along the bundle, inlet (0) to outlet (1)
export const LAG = 0.6; // share of the run the vapor front needs to reach the outlet end
export const STEAM_C = 148; // saturated steam at 3.5 barg
export const AMBIENT_C = 24;
export const CONDENSATE_SHARE = 0.78; // knockout drum fill at the end of the run
export const TOTE_START = 0.92; // chemical tote level at the start
export const TOTE_END = 0.34;
export const LEL_START = 64; // %LEL in the isolated, drained shell before the clean

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ease = (x) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};

// Remaining deposit at station xi (0..1 along the bundle) as a share of the start.
export const depositAt = (xi, p) => 1 - ease((p - LAG * xi) / (1 - LAG));

// Overall heat-transfer coefficient through a deposit of t mm, as a share of clean.
export const uShare = (mm) => 1 / (1 + (U_CLEAN * mm) / 1000 / K_DEPOSIT);

export function state(p) {
  const shares = STATIONS.map((xi) => depositAt(xi, p));
  const samples = Array.from({ length: 41 }, (_, index) => depositAt(index / 40, p));
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const u = samples.reduce((sum, value) => sum + uShare(value * DEPOSIT_MM), 0) / samples.length;
  // Hydrocarbon vapor in the shell as %LEL: it tracks the deposit still to dissolve and
  // reaches zero, safe to open, only when the bundle is clean.
  const lel = LEL_START * mean * mean;
  const active = p > 0 && p < 1 ? 1 : 0;
  const steam = p <= 0 ? 0 : ease(p / 0.08) * (1 - ease((p - 0.9) / 0.1));
  return {
    p,
    shares,
    deposit: DEPOSIT_MM * mean,
    u,
    lel,
    steam,
    active,
    temp: AMBIENT_C + (STEAM_C - AMBIENT_C) * steam,
    pressure: 3.5 * steam,
    drum: CONDENSATE_SHARE * ease(p),
    tote: TOTE_START - (TOTE_START - TOTE_END) * clamp(p / 0.85),
  };
}

export function phaseOf(p) {
  if (p <= 0.001) return "Isolated · fouled";
  if (p < 0.1) return "Steam in";
  if (p < 0.9) return "Vapor-phase clean";
  if (p < 0.999) return "Final sweep";
  return "Clean · gas-free";
}
