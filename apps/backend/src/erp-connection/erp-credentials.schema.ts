import { BadRequestException } from '@nestjs/common';
import { ErpType } from '@prisma/client';

import { normalizeTicimaxCredentials } from '../adapters/ticimax/ticimax-soap.util';

/**
 * ERP credential şemaları (ön muhasebe hattı).
 * Ham secret değerler log veya API yanıtına yazılmaz — yalnızca anahtar adları dokümante edilir.
 */
export const ERP_CREDENTIAL_SCHEMA_DOC: Readonly<
  Partial<Record<ErpType, { required: string[]; optional: string[] }>>
> = {
  [ErpType.BIZIMHESAP]: {
    required: ['token'],
    optional: ['defaultCustomerCode'],
  },
  [ErpType.PARASUT]: {
    required: ['clientId', 'clientSecret', 'companyId'],
    optional: ['refreshToken', 'username', 'password'],
  },
  [ErpType.TICIMAX]: {
    required: ['storeUrl', 'uyeKodu'],
    optional: [],
  },
};

const SENSITIVE_ERP_CREDENTIAL_KEYS = new Set([
  'apikey',
  'apitoken',
  'token',
  'clientsecret',
  'refreshtoken',
  'password',
  'apisecret',
  'secretkey',
  'uyekodu',
]);

function trimCredentialMap(
  credentials: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(credentials)) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      out[key] = trimmed;
    }
  }
  return out;
}

function resolveBizimHesapToken(credentials: Record<string, string>): string {
  return (
    credentials.token?.trim() ||
    credentials.apiKey?.trim() ||
    credentials.firmId?.trim() ||
    ''
  );
}

/** Log/audit için gizli alanları maskele */
export function sanitizeErpCredentialsForLog(
  credentials: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(credentials)) {
    if (SENSITIVE_ERP_CREDENTIAL_KEYS.has(key.toLowerCase())) {
      out[key] = value.length > 0 ? '[redacted]' : '';
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * ERP türüne göre credential doğrular ve normalize edilmiş kopya döner.
 * Desteklenmeyen türlerde yalnızca trim uygulanır.
 */
export function validateAndNormalizeErpCredentials(
  erpType: ErpType,
  credentials: Record<string, string>,
): Record<string, string> {
  const trimmed = trimCredentialMap(credentials);

  if (erpType === ErpType.BIZIMHESAP) {
    const token = resolveBizimHesapToken(trimmed);
    if (!token) {
      throw new BadRequestException('BizimHesap: Token zorunludur.');
    }
    const out: Record<string, string> = { token };
    if (trimmed.defaultCustomerCode) {
      out.defaultCustomerCode = trimmed.defaultCustomerCode;
    }
    return out;
  }

  if (erpType === ErpType.PARASUT) {
    const clientId = trimmed.clientId ?? '';
    const clientSecret = trimmed.clientSecret ?? '';
    const companyId = trimmed.companyId ?? '';
    if (!clientId || !clientSecret || !companyId) {
      throw new BadRequestException(
        'Paraşüt: clientId, clientSecret ve companyId zorunludur.',
      );
    }
    const out: Record<string, string> = { clientId, clientSecret, companyId };
    if (trimmed.refreshToken) {
      out.refreshToken = trimmed.refreshToken;
    }
    if (trimmed.username) {
      out.username = trimmed.username;
    }
    if (trimmed.password) {
      out.password = trimmed.password;
    }
    return out;
  }

  if (erpType === ErpType.TICIMAX) {
    const normalized = normalizeTicimaxCredentials(trimmed);
    if (!normalized) {
      throw new BadRequestException(
        'Ticimax: Mağaza URL ve Üye Kodu zorunludur.',
      );
    }
    return {
      storeUrl: normalized.storeUrl,
      uyeKodu: normalized.uyeKodu,
    };
  }

  return trimmed;
}
