import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10 pt-4">
      <div className="space-y-4">
        <h1 className="text-[34px] font-semibold tracking-tightest leading-[1.05] text-stone-900">
          Diamond pricing,
          <br />
          without the lookup.
        </h1>
        <p className="text-[15px] leading-relaxed text-stone-600">
          Upload your weekly price list PDF. Enter a stone&apos;s specs. Get list
          price, your price, and the lot total instantly. Built for people who
          quote dozens of stones a day.
        </p>
        <div className="flex gap-2 pt-2">
          <Link className="btn-primary" href="/upload">
            Upload price list
          </Link>
          <Link className="btn-outline" href="/calculator">
            Open calculator
          </Link>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-[13px] font-medium uppercase tracking-[0.08em] text-stone-500">
          How it works
        </h3>
        <ol className="mt-3 space-y-3 text-[14px] text-stone-700">
          <Step n={1}>Upload your price list PDF.</Step>
          <Step n={2}>It&apos;s parsed in your browser. Nothing uploads.</Step>
          <Step n={3}>Enter shape, carat, color, clarity, % off list.</Step>
          <Step n={4}>See list price, your price, lot total. Save or export.</Step>
        </ol>
      </div>

      <ul className="space-y-2 text-[13px] text-stone-500">
        <li>· Your PDF stays on your device.</li>
        <li>· Round and pear grids parsed automatically.</li>
        <li>· Lot, recut, history, exports.</li>
        <li>· Live FX rates with manual override.</li>
      </ul>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[12px] font-semibold text-stone-700">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
