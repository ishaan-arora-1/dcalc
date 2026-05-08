"use client";

import {
  clarityColumnsFor,
  isSmallStoneBracket,
  LARGE_STONE_CLARITIES,
  PEAR_BRACKETS,
  ROUND_BRACKETS,
  SMALL_COLOR_GROUPS,
  SMALL_STONE_CLARITIES,
  type CaratBracket,
  type Clarity,
  type Shape,
} from "./brackets";
import type { PriceBook, PriceGrid } from "./types";

/**
 * Parser for the weekly diamond price list PDF.
 *
 * The PDF lays out two price-grid tables per row, side-by-side. Each table is
 * anchored by a bracket header above it that looks like:
 *
 *   RAPAPORT : (.30 - .39 CT.) :     ROUNDS     RAPAPORT : (.40 - .49 CT.) :
 *
 * Tables for sub-0.30 ct brackets use grouped color rows (D-F, G-H, I-J, K-L,
 * M-N) with 8 clarity columns. Tables for 0.30 ct and above use individual
 * color rows (D, E, F, G, H, I, J, K, L, M) with 11 clarity columns.
 *
 * The clarity column headers in the PDF are rendered as a decorative font and
 * cannot be decoded as text by pdfjs. We therefore ignore the header row
 * entirely and infer rows + columns from the positions of the numeric cells.
 */

interface PdfItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

interface BracketHeader {
  /** raw matched text, e.g. ".30 - .39" */
  raw: string;
  /** numeric lo/hi values */
  lo: number;
  hi: number;
  /** matching bracket from our canonical list, if any */
  bracket: CaratBracket | null;
  /** x-coord of the bracket header text */
  x: number;
  y: number;
  /** "left" or "right" half of the page */
  half: "left" | "right";
  /** which shape this row of brackets refers to ("Round" | "Pear") */
  shape: "Round" | "Pear";
}

/** US Letter portrait midline. The PDF view is 612 wide. */
const PAGE_MIDLINE = 306;

const NUM_RE = /^-?\d+(?:\.\d+)?$/;

const BRACKET_RE = /\(\s*(\d*\.?\d+)\s*[-–]\s*(\d*\.?\d+)\s*CT\.?\s*\)/i;

const COLOR_LETTER_SET = new Set(["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"]);
const COLOR_GROUP_SET = new Set(SMALL_COLOR_GROUPS.map((g) => g.id));

function parseLoHi(s: string): number {
  // ".30" → 0.30, "1.00" → 1.00
  return parseFloat(s.startsWith(".") ? `0${s}` : s);
}

function bracketsFor(shape: Shape): CaratBracket[] {
  return shape === "Round" ? ROUND_BRACKETS : PEAR_BRACKETS;
}

function findBracket(shape: Shape, lo: number, hi: number): CaratBracket | null {
  return (
    bracketsFor(shape).find(
      (b) => Math.abs(b.lo - lo) < 0.005 && Math.abs(b.hi - hi) < 0.005,
    ) ?? null
  );
}

/**
 * Identify shape ("Round" or "Pear") for a bracket header by looking for a
 * "ROUNDS" or "PEARS" token at roughly the same y position on the page.
 */
function shapeForBracketRow(items: PdfItem[], y: number): "Round" | "Pear" | null {
  for (const it of items) {
    if (Math.abs(it.y - y) > 3) continue;
    const u = it.str.trim().toUpperCase();
    if (u === "ROUNDS" || u === "ROUND") return "Round";
    if (u === "PEARS" || u === "PEAR") return "Pear";
  }
  return null;
}

/**
 * Cluster items into rows by y-coordinate.
 */
function clusterByY(items: PdfItem[], tol = 3): { y: number; items: PdfItem[] }[] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: { y: number; items: PdfItem[] }[] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= tol) {
      last.items.push(it);
      // keep representative y as the median so it stays stable
      last.y = (last.y + it.y) / 2;
    } else {
      rows.push({ y: it.y, items: [it] });
    }
  }
  return rows;
}

function findBracketHeaders(
  pageItems: PdfItem[],
): BracketHeader[] {
  // The bracket label is split across multiple text items. Group by y row
  // first, then scan each row's joined text for the bracket pattern(s).
  const rows = clusterByY(pageItems, 2);
  const headers: BracketHeader[] = [];
  for (const row of rows) {
    // Find each item that contains "RAPAPORT" — these anchor the lhs/rhs of
    // the bracket label. Then scan forward in the same row for the (lo - hi
    // CT) text.
    const sortedItems = [...row.items].sort((a, b) => a.x - b.x);
    const joinedText = sortedItems.map((i) => i.str).join(" ");
    if (!joinedText.toUpperCase().includes("RAPAPORT")) continue;
    if (!/CT\.?\s*\)/i.test(joinedText)) continue;

    // There may be 1 or 2 brackets on this row. Iterate matches.
    const re = new RegExp(BRACKET_RE, "gi");
    let m: RegExpExecArray | null;
    let cursor = 0;
    while ((m = re.exec(joinedText))) {
      const matchEnd = m.index + m[0].length;
      // Anchor x to the RAPAPORT token preceding this match.
      // Walk through items until we cover m.index characters of the joined
      // text, returning that item's x.
      let runningLen = 0;
      let anchorX = sortedItems[0].x;
      for (const it of sortedItems) {
        const next = runningLen + it.str.length + 1; // +1 for the space
        if (m.index >= runningLen && m.index < next) {
          anchorX = it.x;
          break;
        }
        runningLen = next;
      }
      const lo = parseLoHi(m[1]);
      const hi = parseLoHi(m[2]);
      const half: "left" | "right" = anchorX < PAGE_MIDLINE ? "left" : "right";
      const shape = shapeForBracketRow(pageItems, row.y);
      if (!shape) continue;
      const bracket = findBracket(shape, lo, hi);
      headers.push({
        raw: m[0],
        lo,
        hi,
        bracket,
        x: anchorX,
        y: row.y,
        half,
        shape,
      });
      cursor = matchEnd;
      if (re.lastIndex === cursor) re.lastIndex++;
    }
  }
  return headers;
}

/**
 * For a given bracket header, define the rectangular region that contains its
 * data table on the page.
 *
 * Tables are below their bracket header in PDF coordinates (smaller y). The
 * region's y_max is the header's y minus a small gap; y_min is the y of the
 * NEXT bracket header below in the same half (or 0 if it's the last).
 */
function tableRegion(
  h: BracketHeader,
  allHeaders: BracketHeader[],
): { x0: number; x1: number; y0: number; y1: number } {
  const x0 = h.half === "left" ? 40 : PAGE_MIDLINE + 5;
  const x1 = h.half === "left" ? PAGE_MIDLINE - 5 : 600;

  const sameHalfBelow = allHeaders.filter(
    (other) => other !== h && other.half === h.half && other.y < h.y,
  );
  const nearestBelowY = sameHalfBelow.length
    ? Math.max(...sameHalfBelow.map((o) => o.y))
    : 0;
  const y1 = h.y - 4;
  const y0 = nearestBelowY + 4;
  return { x0, x1, y0, y1 };
}

interface ParsedTableRow {
  /** representative y */
  y: number;
  /** numeric values sorted by x (ascending) */
  values: number[];
}

function extractTableRows(
  pageItems: PdfItem[],
  region: { x0: number; x1: number; y0: number; y1: number },
  expectedCols: number,
): ParsedTableRow[] {
  const inRegion = pageItems.filter(
    (it) =>
      it.x >= region.x0 &&
      it.x <= region.x1 &&
      it.y >= region.y0 &&
      it.y <= region.y1 &&
      NUM_RE.test(it.str.trim()),
  );

  // cluster by y
  const clusters = clusterByY(inRegion, 4);
  const rows: ParsedTableRow[] = [];
  for (const c of clusters) {
    const sorted = [...c.items].sort((a, b) => a.x - b.x);
    if (sorted.length < expectedCols) {
      // Skip incomplete rows — likely fragments / footers / FX strip.
      continue;
    }
    const values = sorted
      .slice(0, expectedCols)
      .map((it) => parseFloat(it.str.trim()));
    rows.push({ y: c.y, values });
  }
  // Sort top-to-bottom (PDF y-desc)
  rows.sort((a, b) => b.y - a.y);
  return rows;
}

export interface ParseResult {
  book: PriceBook;
  warnings: string[];
}

export async function parsePriceListPdf(file: File): Promise<ParseResult> {
  const pdfjs = await import("pdfjs-dist");
  const version = pdfjs.version;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const allItems: PdfItem[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const tc = await page.getTextContent();
    const items = tc.items as Array<{ str: string; transform: number[] }>;
    for (const it of items) {
      const x = it.transform[4];
      const y = it.transform[5];
      const str = (it.str ?? "").trim();
      if (!str) continue;
      allItems.push({ str, x, y, page: pageNum });
    }
  }

  // Date stamp from anywhere in the document.
  let reportDate: string | undefined;
  const allText = allItems.map((i) => i.str).join(" ");
  const dm = allText.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}/,
  );
  if (dm) reportDate = dm[0];

  const warnings: string[] = [];
  const grids: PriceGrid[] = [];
  const seen = new Set<string>(); // shape:bracketId

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const pageItems = allItems.filter((i) => i.page === pageNum);
    if (pageItems.length === 0) continue;

    const headers = findBracketHeaders(pageItems);
    if (headers.length === 0) continue;

    for (const h of headers) {
      if (!h.bracket) {
        warnings.push(
          `Page ${pageNum}: bracket "${h.raw}" doesn't match any known carat range; skipping.`,
        );
        continue;
      }
      const expectedCols = clarityColumnsFor(h.bracket);
      const expectedRows = isSmallStoneBracket(h.bracket) ? 5 : 10;

      const region = tableRegion(h, headers);
      const rows = extractTableRows(pageItems, region, expectedCols);

      // We may pick up rows from the trade-note banner; trim to the top
      // expectedRows by y-desc.
      const tableRows = rows.slice(0, expectedRows);

      if (tableRows.length < expectedRows) {
        warnings.push(
          `Page ${pageNum}: ${h.shape} ${h.bracket.id} ct table — found ${tableRows.length}/${expectedRows} rows. Skipping.`,
        );
        continue;
      }

      const colorOrder: string[] = isSmallStoneBracket(h.bracket)
        ? SMALL_COLOR_GROUPS.map((g) => g.id)
        : ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
      const clarities: Clarity[] = isSmallStoneBracket(h.bracket)
        ? SMALL_STONE_CLARITIES
        : LARGE_STONE_CLARITIES;

      const cells: Record<string, Partial<Record<Clarity, number>>> = {};
      for (let i = 0; i < expectedRows; i++) {
        const rowKey = colorOrder[i];
        const vals = tableRows[i].values;
        const cellRow: Partial<Record<Clarity, number>> = {};
        for (let k = 0; k < clarities.length; k++) cellRow[clarities[k]] = vals[k];
        cells[rowKey] = cellRow;
      }

      const key = `${h.shape}:${h.bracket.id}`;
      if (seen.has(key)) {
        // Duplicate (e.g. same bracket appears twice). Keep the first.
        continue;
      }
      seen.add(key);

      grids.push({
        shape: h.shape,
        bracketId: h.bracket.id,
        rowMode: isSmallStoneBracket(h.bracket) ? "grouped" : "individual",
        cells,
      });
    }
  }

  if (grids.length === 0) {
    warnings.push(
      "No price grids could be parsed. The PDF layout may differ from the expected weekly format.",
    );
  }

  return {
    book: { uploadedAt: Date.now(), reportDate, grids },
    warnings,
  };
}
