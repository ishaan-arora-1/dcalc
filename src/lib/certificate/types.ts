export type Lab = "GIA" | "IGI" | "HRD";

export interface CertificateResult {
  lab: Lab;
  reportNumber: string;
  reportDate?: string;
  shape?: string;
  measurements?: string;
  caratWeight?: string;
  color?: string;
  clarity?: string;
  cut?: string;
  polish?: string;
  symmetry?: string;
  fluorescence?: string;
  depth?: string;
  table?: string;
  girdle?: string;
  culet?: string;
  inscription?: string;
  comments?: string;
  reportType?: string;
  reportUrl?: string;
  rawFields?: Record<string, string>;
}

export interface LookupResponse {
  ok: boolean;
  result?: CertificateResult;
  error?: string;
  warning?: string;
}
