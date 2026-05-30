/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Virgülle ayrılmış: INTEGRATION, ACCOUNTING */
  readonly VITE_DESKTOP_MOCK_PRODUCT_LINES?: string;
  /** NATIVE | EXTERNAL_ERP */
  readonly VITE_DESKTOP_MOCK_ACCOUNTING_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
