# Facet — diamond price calculator

A web app for diamond trade professionals. Upload your weekly diamond price list
PDF, enter a stone's specs, get list price, your price, and the lot total —
instantly. Designed for people who quote dozens of stones a day.

The PDF is parsed entirely in the user's browser. It never leaves the device.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
npm start
```

## How it works

1. **Upload** — On `/upload`, the user picks their weekly price list PDF. The
   browser uses `pdfjs-dist` to extract every text fragment with its (x, y)
   coordinates, then groups them into rows. Per page, the parser detects the
   shape (Round / Pear), the carat-bracket header (`0.30 - 0.39`), the clarity
   header row (`IF VVS1 VVS2 …`), and the data rows that begin with a color
   token (`D`, `E`, …) or a color-group token (`D-F`, `G-H`, …).

2. **Store** — The extracted price grids are saved to **IndexedDB**. The PDF
   itself is **never** persisted. Stored data expires after 7 days, after
   which the calculator locks until the user uploads a fresh PDF.

3. **Calculate** — On `/calculator`, every keystroke does an in-memory lookup:
   maps carat → bracket → grid → row → cell. Cell values are in hundreds of
   USD per carat; multiplying by 100 yields the list $/ct. The discount/premium
   percentage is applied to produce "your price." `SI3` is treated as the
   average of `SI2` and `I1` when the grid lacks a dedicated `SI3` column.
   Fancy shapes (Oval, Princess, Cushion, Marquise, Radiant, Asscher, Heart)
   use the Pear grid per industry convention.

4. **Outputs** — list price/ct, list total, your price/ct, your total, and (if
   quantity > 1) lot total. Everything is convertible to USD / INR / AED / EUR
   / GBP via the free Frankfurter exchange-rate API (cached for 6 hours, with
   a hard-coded fallback so the calculator keeps working offline).

5. **History** — Each saved calculation persists to IndexedDB with **inputs
   and outputs only** — no raw price-list data. Exportable as CSV.

6. **Lot mode** (`/lot`) — Multi-stone parcel builder. Each row prices
   independently. CSV export.

7. **Recut** (`/recut`) — Enter rough weight + expected yield. The app projects
   polished weight, looks up its list value, and computes the implied $/ct of
   the rough.

## Privacy & language

Per spec, every user-facing string says "your price list," "list price,"
"% off/on list," etc. The product never names the price-list provider. The
upload flow requires the user to confirm legitimate use of their PDF, and a
persistent footer states that nothing is uploaded to a server.

## Auth & billing

Auth and Stripe billing are stubbed (see `/account`). The signup form persists
to `localStorage` so the rest of the UI works end-to-end. Wire up your auth
provider (e.g. NextAuth, Clerk) and Stripe checkout when going live; the lock
gate lives in `src/components/PriceBookGate.tsx` if you want to extend it to
gate by subscription state.

## Project layout

```
src/
  app/                # Next.js App Router pages
    page.tsx          # marketing landing
    upload/           # PDF upload + parse
    calculator/       # single-stone calculator
    lot/              # multi-stone lot mode
    recut/            # recut / yield calculator
    history/          # saved calculations
    account/          # account & subscription stub
  components/
    CalculatorForm.tsx
    PriceBookGate.tsx # 7-day expiry gate
  lib/
    pricing/
      brackets.ts     # carat brackets, color/clarity vocab
      types.ts        # PriceBook / PriceGrid shape
      lookup.ts       # grid lookup + calculate()
      notes.ts        # contextual trade-premium notes
      parser.ts       # client-side pdfjs-based parser
    storage/
      db.ts           # IndexedDB (price book, history, lots)
    currency.ts       # FX rates + formatting
    store.ts          # zustand store (active price book)
```

## Notes on the parser

The PDF parser is layout-aware but not pixel-perfect. The weekly price list
publishes the same template each week, so once it works on one week's file it
keeps working. If the layout ever changes, watch the warnings surfaced on the
upload screen — they'll point at exactly which page or table failed to parse.
