import { platformLabel } from '@/pages/campaigns/campaign-labels';
import { customersT } from '@/pages/customers/translations';
import type { CustomerLedgerSummariesMap } from '@/pages/customers/useCustomerLedgerSummaries';
import { api } from '@/lib/api';
import type { CustomerDto } from '@/types/customer';

const EXPORT_PAGE_LIMIT = 100;
const LEDGER_IDS_CHUNK = 80;

export interface CustomersExportFilters {
  search?: string;
  platform?: string;
  segment?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
  minSpent?: number;
  maxSpent?: number;
  minOrders?: number;
  maxOrders?: number;
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return '';
  }
  return iso.slice(0, 10);
}

export async function fetchFilteredCustomersForExport(
  filters: CustomersExportFilters,
): Promise<CustomerDto[]> {
  const all: CustomerDto[] = [];
  let page = 1;
  let total = 0;

  do {
    const { data } = await api.get<{ items: CustomerDto[]; total: number }>('/customers', {
      params: {
        page,
        limit: EXPORT_PAGE_LIMIT,
        ...filters,
      },
    });
    all.push(...data.items);
    total = data.total;
    page += 1;
  } while (all.length < total);

  return all;
}

async function fetchLedgerSummariesBatched(
  customerIds: string[],
): Promise<CustomerLedgerSummariesMap> {
  const result: CustomerLedgerSummariesMap = {};
  for (let i = 0; i < customerIds.length; i += LEDGER_IDS_CHUNK) {
    const chunk = customerIds.slice(i, i + LEDGER_IDS_CHUNK);
    const { data } = await api.get<{ data: CustomerLedgerSummariesMap }>(
      '/accounting/customers/ledger-summaries',
      { params: { ids: chunk.join(',') } },
    );
    Object.assign(result, data.data);
  }
  return result;
}

const NATIVE_CSV_HEADERS = [
  'Ad',
  'E-posta',
  'Telefon',
  'Şehir',
  'Platform',
  customersT('list.columns.debit'),
  customersT('list.columns.credit'),
  customersT('list.columns.balance'),
  'Etiketler',
  'Son sipariş',
] as const;

function customerToNativeRow(
  customer: CustomerDto,
  ledger: CustomerLedgerSummariesMap[string] | undefined,
): string {
  return [
    customer.name,
    customer.email ?? '',
    customer.phone ?? '',
    customer.city ?? '',
    customer.platform ? platformLabel(customer.platform) : '',
    ledger?.debit ?? '0',
    ledger?.credit ?? '0',
    ledger?.balance ?? '0',
    customer.tags.join('|'),
    formatDate(customer.lastOrderAt),
  ]
    .map(escapeCsvCell)
    .join(',');
}

export function nativeCariListToCsv(
  customers: CustomerDto[],
  ledgers: CustomerLedgerSummariesMap,
): string {
  const headerLine = NATIVE_CSV_HEADERS.map(escapeCsvCell).join(',');
  const rows = customers.map((c) => customerToNativeRow(c, ledgers[c.id]));
  return '\uFEFF' + [headerLine, ...rows].join('\n');
}

export function downloadNativeCariCsv(
  customers: CustomerDto[],
  ledgers: CustomerLedgerSummariesMap,
): void {
  const csv = nativeCariListToCsv(customers, ledgers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cariler.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export class CustomersExportNoDataError extends Error {
  constructor() {
    super('NO_DATA');
    this.name = 'CustomersExportNoDataError';
  }
}

export async function exportNativeCariCsv(filters: CustomersExportFilters): Promise<void> {
  const customers = await fetchFilteredCustomersForExport(filters);
  if (customers.length === 0) {
    throw new CustomersExportNoDataError();
  }
  const ledgers = await fetchLedgerSummariesBatched(customers.map((c) => c.id));
  downloadNativeCariCsv(customers, ledgers);
}
