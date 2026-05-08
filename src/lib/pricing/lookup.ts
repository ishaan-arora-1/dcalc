import {
  findBracket,
  isSmallStoneBracket,
  PEAR_BRACKETS,
  ROUND_BRACKETS,
  smallStoneGroupForColor,
  type Clarity,
  type Color,
  type Shape,
} from "./brackets";
import type { PriceBook, PriceGrid } from "./types";

export interface LookupRequest {
  shape: Shape;
  carat: number;
  color: Color;
  clarity: Clarity;
}

export interface LookupResult {
  /** raw value from the parsed grid (hundreds of USD per ct) */
  rawCell: number;
  /** USD per carat */
  listPpc: number;
  bracketId: string;
  /** the shape grid actually used (Round/Pear) */
  resolvedShape: "Round" | "Pear";
  rowKey: string;
  /** True if we substituted Pear grid for a non-Round/Pear shape */
  substitutedFromPear: boolean;
}

/**
 * Resolve which physical grid (Round vs Pear) to use for a user-selected shape.
 * Per spec: only Round + Pear are parsed; all other shapes use the Pear grid.
 */
export function resolveGridShape(shape: Shape): "Round" | "Pear" {
  return shape === "Round" ? "Round" : "Pear";
}

export function shapeBrackets(shape: "Round" | "Pear") {
  return shape === "Round" ? ROUND_BRACKETS : PEAR_BRACKETS;
}

export function findGrid(
  book: PriceBook,
  shape: "Round" | "Pear",
  bracketId: string,
): PriceGrid | undefined {
  return book.grids.find((g) => g.shape === shape && g.bracketId === bracketId);
}

export function lookup(
  book: PriceBook,
  req: LookupRequest,
): LookupResult | { error: string } {
  const resolvedShape = resolveGridShape(req.shape);
  const brackets = shapeBrackets(resolvedShape);
  const bracket = findBracket(brackets, req.carat);
  if (!bracket) return { error: "Carat weight is outside the price list." };

  const grid = findGrid(book, resolvedShape, bracket.id);
  if (!grid) {
    return {
      error: `No ${resolvedShape} grid found for ${bracket.id} ct in the uploaded list.`,
    };
  }

  let rowKey: string;
  if (grid.rowMode === "grouped" || isSmallStoneBracket(bracket)) {
    rowKey = smallStoneGroupForColor(req.color);
  } else {
    rowKey = req.color;
  }

  let clarityKey: Clarity = req.clarity;
  // SI3 trades as a split SI2/I1 — average the two when SI3 isn't an explicit column.
  const row = grid.cells[rowKey];
  if (!row) return { error: `Color ${rowKey} missing in grid for ${bracket.id}.` };

  if (clarityKey === "SI3" && row.SI3 == null) {
    const si2 = row.SI2;
    const i1 = row.I1;
    if (si2 != null && i1 != null) {
      const avg = (si2 + i1) / 2;
      const listPpc = avg * 100;
      return {
        rawCell: avg,
        listPpc,
        bracketId: bracket.id,
        resolvedShape,
        rowKey,
        substitutedFromPear: req.shape !== "Round" && req.shape !== "Pear",
      };
    }
  }

  const cell = row[clarityKey];
  if (cell == null) {
    return { error: `No ${clarityKey} price in row ${rowKey} for ${bracket.id}.` };
  }

  return {
    rawCell: cell,
    listPpc: cell * 100,
    bracketId: bracket.id,
    resolvedShape,
    rowKey,
    substitutedFromPear: req.shape !== "Round" && req.shape !== "Pear",
  };
}

export interface CalcInputs extends LookupRequest {
  /** signed percent. -30 = 30% below list, +5 = 5% premium */
  pct: number;
  quantity: number;
}

export interface CalcOutputs {
  listPpc: number;
  listTotal: number;
  yourPpc: number;
  yourTotal: number;
  lotTotal?: number;
  resolvedShape: "Round" | "Pear";
  bracketId: string;
  rowKey: string;
  substitutedFromPear: boolean;
}

export function calculate(
  book: PriceBook,
  inp: CalcInputs,
): CalcOutputs | { error: string } {
  const r = lookup(book, inp);
  if ("error" in r) return r;
  const listTotal = r.listPpc * inp.carat;
  const yourPpc = r.listPpc * (1 + inp.pct / 100);
  const yourTotal = yourPpc * inp.carat;
  const out: CalcOutputs = {
    listPpc: r.listPpc,
    listTotal,
    yourPpc,
    yourTotal,
    resolvedShape: r.resolvedShape,
    bracketId: r.bracketId,
    rowKey: r.rowKey,
    substitutedFromPear: r.substitutedFromPear,
  };
  if (inp.quantity > 1) out.lotTotal = yourTotal * inp.quantity;
  return out;
}
