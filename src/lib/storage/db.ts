"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { PriceBook } from "../pricing/types";

const DB_NAME = "dcalc-v1";
const DB_VERSION = 1;
const STORE_BOOK = "priceBook";
const STORE_HISTORY = "history";
const STORE_LOTS = "lots";

export const PRICEBOOK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SavedCalculation {
  id: string;
  createdAt: number;
  name?: string;
  client?: string;
  /** raw inputs, not raw price-list data */
  inputs: {
    shape: string;
    carat: number;
    color: string;
    clarity: string;
    pct: number;
    quantity: number;
    currency: string;
  };
  outputs: {
    listPpc: number;
    listTotal: number;
    yourPpc: number;
    yourTotal: number;
    lotTotal?: number;
    bracketId: string;
    rowKey: string;
    resolvedShape: string;
    substitutedFromPear: boolean;
    fxRateToUSD: number;
  };
}

export interface SavedLot {
  id: string;
  createdAt: number;
  name: string;
  client?: string;
  stoneIds: string[];
}

let _dbp: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!_dbp) {
    _dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_BOOK)) db.createObjectStore(STORE_BOOK);
        if (!db.objectStoreNames.contains(STORE_HISTORY))
          db.createObjectStore(STORE_HISTORY, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_LOTS))
          db.createObjectStore(STORE_LOTS, { keyPath: "id" });
      },
    });
  }
  return _dbp;
}

export async function savePriceBook(book: PriceBook): Promise<void> {
  const db = await getDB();
  await db.put(STORE_BOOK, book, "current");
}

export async function loadPriceBook(): Promise<PriceBook | null> {
  const db = await getDB();
  const b = (await db.get(STORE_BOOK, "current")) as PriceBook | undefined;
  return b ?? null;
}

export async function clearPriceBook(): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_BOOK, "current");
}

export function isExpired(book: PriceBook | null): boolean {
  if (!book) return true;
  return Date.now() - book.uploadedAt > PRICEBOOK_TTL_MS;
}

export async function appendHistory(item: SavedCalculation): Promise<void> {
  const db = await getDB();
  await db.put(STORE_HISTORY, item);
}

export async function listHistory(): Promise<SavedCalculation[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE_HISTORY)) as SavedCalculation[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteHistory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_HISTORY, id);
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_HISTORY);
}

export async function saveLot(lot: SavedLot): Promise<void> {
  const db = await getDB();
  await db.put(STORE_LOTS, lot);
}

export async function listLots(): Promise<SavedLot[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE_LOTS)) as SavedLot[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
