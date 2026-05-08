"use client";

import { create } from "zustand";
import type { PriceBook } from "./pricing/types";
import { isExpired, loadPriceBook } from "./storage/db";

interface BookState {
  book: PriceBook | null;
  loading: boolean;
  expired: boolean;
  hydrate: () => Promise<void>;
  setBook: (b: PriceBook | null) => void;
}

export const useBookStore = create<BookState>((set) => ({
  book: null,
  loading: true,
  expired: true,
  hydrate: async () => {
    set({ loading: true });
    const b = await loadPriceBook();
    set({ book: b, expired: isExpired(b), loading: false });
  },
  setBook: (b) => set({ book: b, expired: isExpired(b), loading: false }),
}));
