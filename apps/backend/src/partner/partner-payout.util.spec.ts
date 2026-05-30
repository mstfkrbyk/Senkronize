import {
  ADMIN_PARTNER_PAYOUT_APPROVE_ACTION,
  ADMIN_PARTNER_PAYOUT_REJECT_ACTION,
  mapAuditLogToPayoutRequest,
  PARTNER_PAYOUT_REQUEST_ACTION,
  parsePayoutRequestMetadata,
} from './partner-payout.util';

describe('partner-payout.util', () => {
  describe('parsePayoutRequestMetadata', () => {
    it('returns defaults for null and non-object metadata', () => {
      expect(parsePayoutRequestMetadata(null)).toEqual({
        amountTRY: 0,
        status: 'PENDING',
        reviewedAt: null,
      });
      expect(parsePayoutRequestMetadata('invalid')).toEqual({
        amountTRY: 0,
        status: 'PENDING',
        reviewedAt: null,
      });
    });

    it('parses REJECTED status and reviewedAt', () => {
      expect(
        parsePayoutRequestMetadata({
          amountTRY: 800,
          status: 'REJECTED',
          reviewedAt: '2026-05-22T11:00:00.000Z',
        }),
      ).toEqual({
        amountTRY: 800,
        status: 'REJECTED',
        reviewedAt: '2026-05-22T11:00:00.000Z',
      });
    });

    it('coerces invalid status to PENDING', () => {
      expect(
        parsePayoutRequestMetadata({ status: 'CANCELLED', amountTRY: 100 }),
      ).toEqual({
        amountTRY: 100,
        status: 'PENDING',
        reviewedAt: null,
      });
    });

    it('coerces non-finite amountTRY to zero', () => {
      expect(
        parsePayoutRequestMetadata({ amountTRY: 'not-a-number', status: 'APPROVED' }),
      ).toEqual({
        amountTRY: 0,
        status: 'APPROVED',
        reviewedAt: null,
      });
      expect(parsePayoutRequestMetadata({ amountTRY: NaN })).toMatchObject({
        amountTRY: 0,
      });
    });

    it('treats blank reviewedAt as null', () => {
      expect(
        parsePayoutRequestMetadata({ reviewedAt: '   ', status: 'PENDING' }),
      ).toMatchObject({ reviewedAt: null });
      expect(
        parsePayoutRequestMetadata({ reviewedAt: '', status: 'PENDING' }),
      ).toMatchObject({ reviewedAt: null });
    });
  });

  describe('mapAuditLogToPayoutRequest', () => {
    it('maps audit log to payout request row with partner name', () => {
      const createdAt = new Date('2026-05-01T12:00:00.000Z');
      const row = mapAuditLogToPayoutRequest(
        {
          id: 'log-1',
          actorOrgId: 'partner-1',
          createdAt,
          metadata: { amountTRY: 1500, status: 'APPROVED', reviewedAt: '2026-05-02' },
        },
        'Demo Partner',
      );
      expect(row).toEqual({
        id: 'log-1',
        partnerOrgId: 'partner-1',
        partnerName: 'Demo Partner',
        amountTRY: 1500,
        status: 'APPROVED',
        createdAt: '2026-05-01T12:00:00.000Z',
        reviewedAt: '2026-05-02',
      });
    });

    it('omits partnerName when not provided', () => {
      const row = mapAuditLogToPayoutRequest({
        id: 'log-2',
        actorOrgId: 'partner-2',
        createdAt: new Date('2026-05-03T08:00:00.000Z'),
        metadata: { amountTRY: 250, status: 'PENDING' },
      });
      expect(row.partnerName).toBeUndefined();
      expect(row.amountTRY).toBe(250);
      expect(row.status).toBe('PENDING');
      expect(row.reviewedAt).toBeNull();
    });
  });

  describe('action constants', () => {
    it('exports stable audit action keys', () => {
      expect(PARTNER_PAYOUT_REQUEST_ACTION).toBe('partner.payout_request');
      expect(ADMIN_PARTNER_PAYOUT_APPROVE_ACTION).toBe('admin.partner_payout_approve');
      expect(ADMIN_PARTNER_PAYOUT_REJECT_ACTION).toBe('admin.partner_payout_reject');
    });
  });
});
