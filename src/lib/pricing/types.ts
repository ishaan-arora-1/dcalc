import type { Clarity, Shape } from "./brackets";

/**
 * A single price grid table extracted from the price list PDF.
 *
 * For small-stone (sub-0.90 ct) tables the row keys are color-group ids
 * ("D-F", "G-H", ...). For larger-stone tables the row keys are individual
 * color letters ("D", "E", ...). The consumer (lookup) handles both.
 */
export interface PriceGrid {
  shape: Shape;
  bracketId: string;
  /** "grouped" (small stones) or "individual" (large stones) */
  rowMode: "grouped" | "individual";
  /** prices in hundreds of USD per carat (raw grid value) */
  cells: Record<string, Partial<Record<Clarity, number>>>;
}

export interface PriceBook {
  /** ISO date the user uploaded this list */
  uploadedAt: number;
  /** Optional date string parsed from the document header (e.g. "March 20, 2026") */
  reportDate?: string;
  grids: PriceGrid[];
}
