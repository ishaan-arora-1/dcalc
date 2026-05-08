import { NextRequest, NextResponse } from "next/server";
import { fetchCertificate } from "@/lib/certificate/fetchers";
import type { Lab, LookupResponse } from "@/lib/certificate/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_LABS = new Set<Lab>(["GIA", "IGI", "HRD"]);

export async function GET(req: NextRequest): Promise<NextResponse<LookupResponse>> {
  const { searchParams } = new URL(req.url);
  const lab = (searchParams.get("lab") || "").toUpperCase() as Lab;
  const reportNumber = (searchParams.get("number") || "").trim();

  if (!VALID_LABS.has(lab)) {
    return NextResponse.json(
      { ok: false, error: "Choose a valid lab: GIA, IGI, or HRD." },
      { status: 400 },
    );
  }
  if (!reportNumber) {
    return NextResponse.json(
      { ok: false, error: "Enter a certificate number." },
      { status: 400 },
    );
  }

  try {
    const result = await fetchCertificate(lab, reportNumber);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
