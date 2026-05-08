"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/calculator", label: "Calc", icon: IconCalc },
  { href: "/history", label: "History", icon: IconHistory },
  { href: "/account", label: "More", icon: IconMore },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((t) => {
        const active = path?.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className="tab"
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function IconCalc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8M8 12h2M12 12h.01M16 12h.01M8 16h2M12 16h.01M16 16h.01" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  );
}
