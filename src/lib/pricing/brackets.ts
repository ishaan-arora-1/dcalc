export type Shape =
  | "Round"
  | "Pear"
  | "Oval"
  | "Emerald"
  | "Princess"
  | "Cushion"
  | "Marquise"
  | "Radiant"
  | "Asscher"
  | "Heart";

export type Color = "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M";

export const COLORS: Color[] = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

export type Clarity =
  | "IF"
  | "VVS1"
  | "VVS2"
  | "VS1"
  | "VS2"
  | "SI1"
  | "SI2"
  | "SI3"
  | "I1"
  | "I2"
  | "I3";

export const CLARITIES: Clarity[] = [
  "IF",
  "VVS1",
  "VVS2",
  "VS1",
  "VS2",
  "SI1",
  "SI2",
  "SI3",
  "I1",
  "I2",
  "I3",
];

export const SHAPES: Shape[] = [
  "Round",
  "Pear",
  "Oval",
  "Emerald",
  "Princess",
  "Cushion",
  "Marquise",
  "Radiant",
  "Asscher",
  "Heart",
];

/** Two-letter codes shown in the scroll-wheel UI (trade shorthand). */
export const SHAPE_CODE: Record<Shape, string> = {
  Round: "BR",
  Pear: "PS",
  Oval: "OV",
  Emerald: "EM",
  Princess: "PR",
  Cushion: "CU",
  Marquise: "MQ",
  Radiant: "RAD",
  Asscher: "AC",
  Heart: "HT",
};

export interface CaratBracket {
  /** inclusive low */
  lo: number;
  /** inclusive high */
  hi: number;
  /** stable id like "0.30-0.39" */
  id: string;
}

const mk = (lo: number, hi: number): CaratBracket => ({
  lo,
  hi,
  id: `${lo.toFixed(2)}-${hi.toFixed(2)}`,
});

export const ROUND_BRACKETS: CaratBracket[] = [
  mk(0.01, 0.03),
  mk(0.04, 0.07),
  mk(0.08, 0.14),
  mk(0.15, 0.17),
  mk(0.18, 0.22),
  mk(0.23, 0.29),
  mk(0.3, 0.39),
  mk(0.4, 0.49),
  mk(0.5, 0.69),
  mk(0.7, 0.89),
  mk(0.9, 0.99),
  mk(1.0, 1.49),
  mk(1.5, 1.99),
  mk(2.0, 2.99),
  mk(3.0, 3.99),
  mk(4.0, 4.99),
  mk(5.0, 5.99),
  mk(10.0, 10.99),
];

export const PEAR_BRACKETS: CaratBracket[] = [
  mk(0.18, 0.22),
  mk(0.23, 0.29),
  mk(0.3, 0.39),
  mk(0.4, 0.49),
  mk(0.5, 0.69),
  mk(0.7, 0.89),
  mk(0.9, 0.99),
  mk(1.0, 1.49),
  mk(1.5, 1.99),
  mk(2.0, 2.99),
  mk(3.0, 3.99),
  mk(4.0, 4.99),
  mk(5.0, 5.99),
  mk(10.0, 10.99),
];

/**
 * Some carats fall between explicit brackets (e.g. 6.50, 7.50). The price list
 * convention uses the highest bracket whose lo is <= weight. We snap up to the
 * nearest bracket that contains the weight; if weight exceeds all brackets we
 * clamp to the largest bracket.
 */
export function findBracket(
  brackets: CaratBracket[],
  carat: number,
): CaratBracket | null {
  if (!Number.isFinite(carat) || carat <= 0) return null;
  for (const b of brackets) {
    if (carat >= b.lo && carat <= b.hi) return b;
  }
  // gaps (e.g. 6.00–9.99) → use last bracket whose lo <= carat
  let best: CaratBracket | null = null;
  for (const b of brackets) {
    if (b.lo <= carat) best = b;
  }
  return best;
}

/**
 * Rapaport-style color groups used on the smaller-stones page (0.01–0.89).
 * Larger stones use individual rows per color. The parser distinguishes the two.
 */
export const SMALL_COLOR_GROUPS: { id: string; colors: Color[] }[] = [
  { id: "D-F", colors: ["D", "E", "F"] },
  { id: "G-H", colors: ["G", "H"] },
  { id: "I-J", colors: ["I", "J"] },
  { id: "K-L", colors: ["K", "L"] },
  { id: "M-N", colors: ["M"] },
];

export function smallStoneGroupForColor(color: Color): string {
  const g = SMALL_COLOR_GROUPS.find((g) => g.colors.includes(color));
  return g ? g.id : "D-F";
}

/**
 * Brackets that use the grouped-color (5-row, 8-column) format on the price
 * list. The actual cutoff is 0.30 ct: anything strictly below 0.30 ct uses
 * grouped colors (D-F, G-H, I-J, K-L, M-N) and 8 clarity columns; 0.30 ct and
 * above uses individual color rows (D…M) and 11 clarity columns.
 */
export function isSmallStoneBracket(b: CaratBracket): boolean {
  return b.hi < 0.3;
}

/** Number of clarity columns for a given bracket. */
export function clarityColumnsFor(b: CaratBracket): number {
  return isSmallStoneBracket(b) ? 8 : 11;
}

/** Clarity column order for grouped (sub-0.30 ct) tables. */
export const SMALL_STONE_CLARITIES: Clarity[] = [
  "IF",
  "VVS1",
  "VVS2",
  "VS1",
  "VS2",
  "SI1",
  "SI2",
  "I1",
];

/** Clarity column order for individual-color (0.30 ct+) tables. */
export const LARGE_STONE_CLARITIES: Clarity[] = [
  "IF",
  "VVS1",
  "VVS2",
  "VS1",
  "VS2",
  "SI1",
  "SI2",
  "SI3",
  "I1",
  "I2",
  "I3",
];
