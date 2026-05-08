export interface TradeNote {
  range: [number, number];
  text: string;
}

export const TRADE_NOTES: TradeNote[] = [
  { range: [0.6, 0.69], text: "0.60–0.69 ct may trade at a 10–15% premium over 0.50 ct prices." },
  { range: [0.7, 0.73], text: "0.70–0.73 ct may trade at a discount to list." },
  { range: [0.8, 0.89], text: "0.80–0.89 ct may trade at a 10–15% premium." },
  { range: [0.95, 0.99], text: "0.95–0.99 ct may trade at a 10–15% premium over 0.90 ct prices." },
  { range: [1.25, 1.49], text: "1.25–1.49 ct may trade at a 10–15% premium over 1.00 ct prices." },
  { range: [1.7, 1.99], text: "1.70–1.99 ct may trade at a 10–20% premium over 1.50 ct prices." },
  { range: [2.5, 3.49], text: "2.50+ ct may trade at a 15–25% premium over 2.00 ct prices." },
  { range: [3.5, 3.99], text: "3.50+ ct may trade at a 10–15% premium over the straight 3 ct size." },
  { range: [4.5, 4.99], text: "4.50+ ct may trade at a 10–15% premium over the straight 4 ct size." },
];

export function notesFor(carat: number): string[] {
  return TRADE_NOTES.filter((n) => carat >= n.range[0] && carat <= n.range[1]).map(
    (n) => n.text,
  );
}
