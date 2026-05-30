import { BadRequestException } from '@nestjs/common';
import { ErpType } from '@prisma/client';

import {
  sanitizeErpCredentialsForLog,
  validateAndNormalizeErpCredentials,
} from './erp-credentials.schema';

describe('erp-credentials.schema', () => {
  describe('validateAndNormalizeErpCredentials', () => {
    it('normalizes BizimHesap credentials', () => {
      const result = validateAndNormalizeErpCredentials(ErpType.BIZIMHESAP, {
        token: ' 485E152158494BE590B5F72403398765 ',
        defaultCustomerCode: ' PERAKENDE ',
      });
      expect(result).toEqual({
        token: '485E152158494BE590B5F72403398765',
        defaultCustomerCode: 'PERAKENDE',
      });
    });

    it('accepts legacy apiKey as BizimHesap token', () => {
      const result = validateAndNormalizeErpCredentials(ErpType.BIZIMHESAP, {
        apiKey: 'legacy-token',
      });
      expect(result).toEqual({ token: 'legacy-token' });
    });

    it('rejects BizimHesap without token', () => {
      expect(() =>
        validateAndNormalizeErpCredentials(ErpType.BIZIMHESAP, { defaultCustomerCode: 'X' }),
      ).toThrow(BadRequestException);
    });

    it('normalizes Paraşüt required fields', () => {
      const result = validateAndNormalizeErpCredentials(ErpType.PARASUT, {
        clientId: 'cid',
        clientSecret: 'secret',
        companyId: '99',
        refreshToken: 'rt',
      });
      expect(result).toEqual({
        clientId: 'cid',
        clientSecret: 'secret',
        companyId: '99',
        refreshToken: 'rt',
      });
    });

    it('rejects Paraşüt missing companyId', () => {
      expect(() =>
        validateAndNormalizeErpCredentials(ErpType.PARASUT, {
          clientId: 'a',
          clientSecret: 'b',
        }),
      ).toThrow(BadRequestException);
    });

    it('normalizes Ticimax storeUrl and uyeKodu', () => {
      const result = validateAndNormalizeErpCredentials(ErpType.TICIMAX, {
        storeUrl: 'mixelektrik.com.tr',
        uyeKodu: ' member-code ',
      });
      expect(result).toEqual({
        storeUrl: 'https://mixelektrik.com.tr',
        uyeKodu: 'member-code',
      });
    });

    it('rejects Ticimax without uyeKodu', () => {
      expect(() =>
        validateAndNormalizeErpCredentials(ErpType.TICIMAX, {
          storeUrl: 'https://shop.test',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('sanitizeErpCredentialsForLog', () => {
    it('redacts sensitive keys', () => {
      const out = sanitizeErpCredentialsForLog({
        clientId: 'visible',
        clientSecret: 'hidden',
        companyId: '1',
      });
      expect(out.clientId).toBe('visible');
      expect(out.clientSecret).toBe('[redacted]');
      expect(out.companyId).toBe('1');
    });
  });
});
