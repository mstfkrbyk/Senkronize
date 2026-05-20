export type ErpKind = 'BIZIMHESAP' | 'LOGO' | 'PARASUT' | 'MIKRO';

export const ERP_LABELS: Record<ErpKind, string> = {
  BIZIMHESAP: 'Bizim Hesap',
  LOGO: 'Logo Tiger',
  PARASUT: 'Paraşüt',
  MIKRO: 'Mikro',
};

export interface ErpBridgeFormState {
  erpType: ErpKind;
  serverIp: string;
  serverPort: string;
  dbName: string;
  apiKey: string;
  apiToken: string;
  connectionString: string;
}

export interface ErpResourceCounts {
  products: number | null;
  orders: number | null;
  stock: number | null;
  updatedAt: string | null;
}

const FORM_KEY = 'senkronize-erp-bridge-form';
const COUNTS_KEY = 'senkronize-erp-resource-counts';

const DEFAULT_FORM: ErpBridgeFormState = {
  erpType: 'LOGO',
  serverIp: '',
  serverPort: '1433',
  dbName: '',
  apiKey: '',
  apiToken: '',
  connectionString: '',
};

export function loadErpBridgeForm(): ErpBridgeFormState {
  try {
    const raw = localStorage.getItem(FORM_KEY);
    if (!raw) {
      return { ...DEFAULT_FORM };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_FORM };
    }
    const p = parsed as Partial<ErpBridgeFormState>;
    const erpType =
      p.erpType === 'BIZIMHESAP' || p.erpType === 'LOGO' || p.erpType === 'PARASUT' || p.erpType === 'MIKRO'
        ? p.erpType
        : DEFAULT_FORM.erpType;
    return { ...DEFAULT_FORM, ...p, erpType };
  } catch {
    return { ...DEFAULT_FORM };
  }
}

export function saveErpBridgeForm(form: ErpBridgeFormState): void {
  localStorage.setItem(FORM_KEY, JSON.stringify(form));
}

export function loadErpResourceCounts(): ErpResourceCounts {
  try {
    const raw = localStorage.getItem(COUNTS_KEY);
    if (!raw) {
      return { products: null, orders: null, stock: null, updatedAt: null };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { products: null, orders: null, stock: null, updatedAt: null };
    }
    const p = parsed as Partial<ErpResourceCounts>;
    return {
      products: typeof p.products === 'number' ? p.products : null,
      orders: typeof p.orders === 'number' ? p.orders : null,
      stock: typeof p.stock === 'number' ? p.stock : null,
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : null,
    };
  } catch {
    return { products: null, orders: null, stock: null, updatedAt: null };
  }
}

export function saveErpResourceCounts(counts: ErpResourceCounts): void {
  localStorage.setItem(COUNTS_KEY, JSON.stringify(counts));
}
