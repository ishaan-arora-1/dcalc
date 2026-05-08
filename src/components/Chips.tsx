"use client";

interface ChipsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: ChipsProps<T>) {
  return (
    <div className="chips" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          aria-pressed={value === opt}
          className="chip"
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
