import type { CertificateResult, Lab } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&deg;/g, "°")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * GIA Report Check.
 * Public endpoint behind https://www.gia.edu/report-check returns JSON for valid reports.
 */
export async function fetchGIA(reportNumber: string): Promise<CertificateResult> {
  const cleaned = reportNumber.trim().replace(/\s|-/g, "");
  // GIA's report check AJAX endpoint
  const url = `https://www.gia.edu/report-check-landing.html?reportno=${encodeURIComponent(cleaned)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GIA returned status ${res.status}`);
  const html = await res.text();

  // GIA renders a results table with <th>Label</th><td>Value</td>
  const fields: Record<string, string> = {};
  const rowRe = /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const label = stripTags(m[1]);
    const value = stripTags(m[2]);
    if (label && value) fields[label.toLowerCase()] = value;
  }

  // Some versions render <dt>/<dd>
  const dtRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  while ((m = dtRe.exec(html)) !== null) {
    const label = stripTags(m[1]);
    const value = stripTags(m[2]);
    if (label && value) fields[label.toLowerCase()] = value;
  }

  const titleNoMatch = /no records? found|not match|invalid report/i.test(html);
  if (Object.keys(fields).length === 0 && titleNoMatch) {
    throw new Error("No GIA report found for that number.");
  }
  if (Object.keys(fields).length === 0) {
    throw new Error(
      "GIA blocked automated access. Try opening the report directly on gia.edu.",
    );
  }

  return {
    lab: "GIA",
    reportNumber: cleaned,
    reportDate: fields["report date"],
    shape: fields["shape and cutting style"] || fields["shape"],
    measurements: fields["measurements"],
    caratWeight: fields["carat weight"],
    color: fields["color grade"] || fields["color"],
    clarity: fields["clarity grade"] || fields["clarity"],
    cut: fields["cut grade"],
    polish: fields["polish"],
    symmetry: fields["symmetry"],
    fluorescence: fields["fluorescence"],
    depth: fields["depth"],
    table: fields["table"],
    girdle: fields["girdle"],
    culet: fields["culet"],
    inscription: fields["inscription(s)"] || fields["inscription"],
    comments: fields["comments"],
    reportType: fields["report type"] || fields["report"],
    reportUrl: `https://www.gia.edu/report-check?reportno=${encodeURIComponent(cleaned)}`,
    rawFields: fields,
  };
}

/**
 * IGI Report verification.
 * Public iReport JSON endpoint used by https://www.igi.org/verify-your-report/
 */
export async function fetchIGI(reportNumber: string): Promise<CertificateResult> {
  const cleaned = reportNumber.trim().replace(/\s|-/g, "");
  const url = `https://www.igi.org/API/api/ReportCheck/GetReportDetailsForVerifyByReportNumber?reportNo=${encodeURIComponent(cleaned)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Referer: "https://www.igi.org/verify-your-report/",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`IGI returned status ${res.status}`);

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("IGI returned an unexpected response.");
  }

  // IGI typically returns either an object or { Data: {...}, Success: bool }
  const root = data as Record<string, unknown>;
  const payload =
    (root && typeof root === "object" && "Data" in root
      ? (root.Data as Record<string, unknown>)
      : root) ?? {};

  const get = (k: string): string | undefined => {
    const v = (payload as Record<string, unknown>)[k];
    if (v == null || v === "") return undefined;
    return String(v);
  };

  const reportNo = get("ReportNo") || get("ReportNumber") || cleaned;
  if (!get("Shape") && !get("Weight") && !get("CaratWeight") && !get("Color")) {
    throw new Error("No IGI report found for that number.");
  }

  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v != null && typeof v !== "object") fields[k] = String(v);
  }

  return {
    lab: "IGI",
    reportNumber: reportNo,
    reportDate: get("ReportDate") || get("Date"),
    shape: get("Shape"),
    measurements: get("Measurements"),
    caratWeight: get("Weight") || get("CaratWeight"),
    color: get("Color"),
    clarity: get("Clarity"),
    cut: get("Cut") || get("CutGrade"),
    polish: get("Polish"),
    symmetry: get("Symmetry"),
    fluorescence: get("Fluorescence"),
    depth: get("Depth") || get("TotalDepth"),
    table: get("Table"),
    girdle: get("Girdle"),
    culet: get("Culet"),
    inscription: get("Inscription") || get("LaserInscription"),
    comments: get("Comments") || get("KeyToSymbols"),
    reportType: get("ReportType"),
    reportUrl: `https://www.igi.org/verify-your-report/?r=${encodeURIComponent(reportNo)}`,
    rawFields: fields,
  };
}

/**
 * HRD Antwerp report verification.
 * Best-effort scrape of https://my.hrdantwerp.com/?record_number=...
 */
export async function fetchHRD(reportNumber: string): Promise<CertificateResult> {
  const cleaned = reportNumber.trim().replace(/\s|-/g, "");
  const url = `https://my.hrdantwerp.com/?record_number=${encodeURIComponent(cleaned)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HRD returned status ${res.status}`);
  const html = await res.text();

  const fields: Record<string, string> = {};
  // HRD layout: pairs of <div class="label">X</div><div class="value">Y</div>
  const pairRe =
    /<(?:div|span|td)[^>]*class="[^"]*label[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span|td)>\s*<(?:div|span|td)[^>]*class="[^"]*value[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span|td)>/gi;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(html)) !== null) {
    const label = stripTags(m[1]);
    const value = stripTags(m[2]);
    if (label && value) fields[label.toLowerCase()] = value;
  }
  // Generic dt/dd fallback
  const dtRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  while ((m = dtRe.exec(html)) !== null) {
    const label = stripTags(m[1]);
    const value = stripTags(m[2]);
    if (label && value) fields[label.toLowerCase()] = value;
  }

  if (Object.keys(fields).length === 0) {
    if (/not\s*found|invalid|no\s*record/i.test(html)) {
      throw new Error("No HRD report found for that number.");
    }
    throw new Error(
      "HRD did not return parseable details. Try opening the report on hrdantwerp.com.",
    );
  }

  return {
    lab: "HRD",
    reportNumber: cleaned,
    reportDate: fields["report date"] || fields["date"],
    shape: fields["shape"] || fields["shape and cut"],
    measurements: fields["measurements"] || fields["dimensions"],
    caratWeight: fields["carat weight"] || fields["weight"],
    color: fields["colour"] || fields["color"],
    clarity: fields["clarity"],
    cut: fields["cut"] || fields["cut grade"],
    polish: fields["polish"],
    symmetry: fields["symmetry"],
    fluorescence: fields["fluorescence"],
    depth: fields["depth"] || fields["total depth"],
    table: fields["table"],
    girdle: fields["girdle"],
    culet: fields["culet"],
    inscription: fields["inscription"] || fields["laser inscription"],
    comments: fields["comments"],
    reportType: fields["report type"],
    reportUrl: url,
    rawFields: fields,
  };
}

export async function fetchCertificate(
  lab: Lab,
  reportNumber: string,
): Promise<CertificateResult> {
  switch (lab) {
    case "GIA":
      return fetchGIA(reportNumber);
    case "IGI":
      return fetchIGI(reportNumber);
    case "HRD":
      return fetchHRD(reportNumber);
  }
}
