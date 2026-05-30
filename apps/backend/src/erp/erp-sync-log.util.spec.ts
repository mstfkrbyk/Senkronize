import {
  buildErpSyncJobType,
  parseErpSyncJobType,
  resolveErpSyncLogErpType,
} from './erp-sync-log.util';

describe('erp-sync-log.util', () => {
  describe('buildErpSyncJobType', () => {
    it('embeds erp type in job type', () => {
      expect(buildErpSyncJobType('BIZIMHESAP', 'conn-1', 'stock')).toBe(
        'erp:BIZIMHESAP:conn-1:stock',
      );
    });
  });

  describe('parseErpSyncJobType', () => {
    it('parses new format', () => {
      expect(parseErpSyncJobType('erp:BIZIMHESAP:conn-1:products')).toEqual({
        erpType: 'BIZIMHESAP',
        erpConnectionId: 'conn-1',
        syncType: 'products',
      });
    });

    it('parses legacy format', () => {
      expect(parseErpSyncJobType('erp:conn-1:stock')).toEqual({
        erpType: '',
        erpConnectionId: 'conn-1',
        syncType: 'stock',
      });
    });
  });

  describe('resolveErpSyncLogErpType', () => {
    it('reads erp type from new job type', () => {
      expect(
        resolveErpSyncLogErpType(
          'erp:BIZIMHESAP:conn-1:invoices',
          new Map(),
        ),
      ).toBe('BIZIMHESAP');
    });

    it('falls back to connection map for legacy job type', () => {
      const map = new Map([['conn-1', 'BIZIMHESAP' as const]]);
      expect(resolveErpSyncLogErpType('erp:conn-1:stock', map)).toBe(
        'BIZIMHESAP',
      );
    });
  });
});
