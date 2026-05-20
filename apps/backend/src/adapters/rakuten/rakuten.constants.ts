/** Rakuten RMS Item API (XML) */
export const RAKUTEN_API_BASE = 'https://api.rms.rakuten.co.jp/es/1.0';

/** Rakuten Pay Order API (JSON) */
export const RAKUTEN_PAY_API_BASE = 'https://api.rms.rakuten.co.jp/es/2.0';

/** searchOrder — tüm işlem durumları */
export const RAKUTEN_ORDER_PROGRESS_LIST = [
  100, 200, 300, 400, 500, 600, 700, 800, 900,
] as const;
