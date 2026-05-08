import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: "Facet — diamond price calculator",
  description:
    "Instant diamond pricing for the trade. Upload your price list PDF and calculate in seconds.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fafaf9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-white/80 backdrop-blur-md">
          <div className="mx-auto max-w-xl px-5 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-stone-900" />
              <span className="font-semibold tracking-tight text-stone-900 text-[15px]">
                Facet
              </span>
            </Link>
            <Link
              href="/upload"
              className="text-[13px] font-medium text-stone-600 hover:text-stone-900"
            >
              Price list
            </Link>
          </div>
        </header>

        <main className="flex-1 pb-24">
          <div className="mx-auto max-w-xl px-5 py-6">{children}</div>
        </main>

        <TabBar />

        <footer className="hidden">
          {/* Disclaimer is rendered inline on the upload screen and account page;
              we keep it out of the chrome to maintain whitespace on small screens. */}
        </footer>
      </body>
    </html>
  );
}
