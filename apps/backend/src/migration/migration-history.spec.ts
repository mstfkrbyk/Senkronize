import {
  appendMigrationImportHistory,
  buildHistoryRecordFromSession,
  parseMigrationImportHistory,
  toMigrationHistoryItem,
} from './migration-history';
import type { MigrationSession } from './migration.types';

function baseSession(overrides: Partial<MigrationSession> = {}): MigrationSession {
  return {
    id: 'sess-1',
    organizationId: 'org-1',
    dataType: 'products',
    sourceFormat: 'generic_csv',
    fileName: 'urunler.csv',
    mimeType: 'text/csv',
    headers: ['name', 'sku'],
    rawRows: [{ name: 'A', sku: '1' }],
    columnMapping: { name: 'name', sku: 'sku' },
    status: 'completed',
    progress: {
      processed: 1,
      total: 1,
      imported: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
    rowErrors: [],
    createdAt: '2026-05-20T10:00:00.000Z',
    updatedAt: '2026-05-20T10:05:00.000Z',
    ...overrides,
  };
}

describe('migration-history', () => {
  it('parseMigrationImportHistory boş metadata için [] döner', () => {
    expect(parseMigrationImportHistory(null)).toEqual([]);
    expect(parseMigrationImportHistory({})).toEqual([]);
  });

  it('geçerli kayıtları tarihe göre yeniden eskiye sıralar', () => {
    const meta = {
      migrationImportHistory: [
        {
          id: 'old',
          createdAt: '2026-01-01T00:00:00.000Z',
          sourceFormat: 'generic_csv',
          dataType: 'products',
          fileName: 'a.csv',
          total: 1,
          success: 1,
          failed: 0,
          status: 'completed',
        },
        {
          id: 'new',
          createdAt: '2026-06-01T00:00:00.000Z',
          sourceFormat: 'entegra_json',
          dataType: 'orders',
          fileName: 'b.json',
          total: 2,
          success: 2,
          failed: 0,
          status: 'completed',
        },
      ],
    };
    const parsed = parseMigrationImportHistory(meta);
    expect(parsed.map((r) => r.id)).toEqual(['new', 'old']);
  });

  it('buildHistoryRecordFromSession başarı ve hata sayılarını hesaplar', () => {
    const record = buildHistoryRecordFromSession(
      baseSession({
        progress: {
          processed: 3,
          total: 3,
          imported: 1,
          updated: 1,
          skipped: 0,
          failed: 1,
        },
        rowErrors: [{ row: 2, field: 'sku', message: 'Eksik' }],
      }),
      'completed',
    );
    expect(record.success).toBe(2);
    expect(record.failed).toBe(1);
    expect(record.errors).toHaveLength(1);
  });

  it('appendMigrationImportHistory aynı id ile günceller ve üst sınırı korur', () => {
    const initial = { invoiceNumberPrefix: 'F' };
    const first = appendMigrationImportHistory(initial, {
      id: 'a',
      createdAt: '2026-01-01T00:00:00.000Z',
      sourceFormat: 'generic_csv',
      dataType: 'products',
      fileName: 'x.csv',
      total: 1,
      success: 1,
      failed: 0,
      status: 'completed',
    });
    const updated = appendMigrationImportHistory(first, {
      id: 'a',
      createdAt: '2026-02-01T00:00:00.000Z',
      sourceFormat: 'generic_csv',
      dataType: 'products',
      fileName: 'x2.csv',
      total: 2,
      success: 2,
      failed: 0,
      status: 'completed',
    });
    const list = parseMigrationImportHistory(updated);
    expect(list).toHaveLength(1);
    expect(list[0]?.fileName).toBe('x2.csv');
    expect((updated as Record<string, unknown>).invoiceNumberPrefix).toBe('F');
  });

  it('toMigrationHistoryItem sourceLabel üretir', () => {
    const item = toMigrationHistoryItem(
      buildHistoryRecordFromSession(baseSession(), 'completed'),
    );
    expect(item.sourceLabel).toBe('CSV');
    expect(item.id).toBe('sess-1');
  });
});
