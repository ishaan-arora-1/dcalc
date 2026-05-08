"use client";

import { CalculatorForm } from "@/components/CalculatorForm";
import { PriceBookGate } from "@/components/PriceBookGate";

export default function CalculatorPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight text-white">
          Calculator
        </h1>
        <p className="text-[12px] text-neutral-500">
          Scroll to select · live totals
        </p>
      </header>
      <PriceBookGate>
        <CalculatorForm />
      </PriceBookGate>
    </div>
  );
}
