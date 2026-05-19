import type { Metadata, Viewport } from "next";
import Image from "next/image";
import "./globals.css";
import Link from "next/link";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: "Diamond Master — diamond price calculator",
  description:
    "Diamond Master: instant diamond pricing for the trade. Upload your price list PDF and calculate in seconds.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 antialiased">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/90 backdrop-blur-md">
          <div className="mx-auto max-w-xl px-5 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-1">
              <Image
                src="/dcalc logo.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 object-contain"
                priority
              />
              <span className="font-semibold tracking-tight text-white text-[15px]">
                Diamond Master
              </span>
            </Link>
            <Link
              href="/upload"
              className="text-[13px] font-medium text-neutral-400 hover:text-white"
            >
              Price list
            </Link>
          </div>
        </header>

        <main className="flex-1 pb-24">
          <div className="mx-auto max-w-xl px-5 py-6">{children}</div>
        </main>

        <TabBar />
      </body>
    </html>
  );
}
