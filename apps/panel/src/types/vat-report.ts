export interface VatReportPeriod {
  year: number;
  month: number;
}

export interface VatPlatformBreakdown {
  platform: string;
  orderCount: number;
  grossSales: number;
  vatAmount: number;
  netSales: number;
}

export interface VatRateBreakdown {
  vatRatePercent: number;
  grossSales: number;
  vatAmount: number;
  netSales: number;
}

export interface VatReport {
  period: VatReportPeriod;
  grossSales: number;
  vatAmount: number;
  netSales: number;
  byPlatform: VatPlatformBreakdown[];
  byVatRate: VatRateBreakdown[];
  reportingNote: string;
  defaultVatRatePercent: number;
}
