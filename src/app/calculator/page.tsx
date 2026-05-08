"use client";

import { CalculatorForm } from "@/components/CalculatorForm";
import { PriceBookGate } from "@/components/PriceBookGate";

export default function CalculatorPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-stone-900">
          Calculator
        </h1>
        <p className="text-[13px] text-stone-500">
          Live result as you type.
        </p>
      </div>
      <PriceBookGate>
        <CalculatorForm />
      </PriceBookGate>
    </div>
  );
}
