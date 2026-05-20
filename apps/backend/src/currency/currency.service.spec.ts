import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import { CurrencyService } from './currency.service';

describe('CurrencyService', () => {
  let service: CurrencyService;
  let prisma: {
    organization: { findFirst: jest.Mock };
    exchangeRate: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(() => {
    prisma = {
      organization: { findFirst: jest.fn() },
      exchangeRate: { findFirst: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    service = new CurrencyService(
      prisma as unknown as PrismaService,
      cache as unknown as CacheService,
    );
  });

  it('USD → TRY dönüşümü doğru hesaplanır', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      currencyPreferManualRates: true,
      currencyTcmbEnabled: false,
      currencyManualRates: { USD: 34.5 },
    });

    const result = await service.convert(
      new Decimal(10),
      'USD',
      'TRY',
      new Date(),
      'org-1',
    );

    expect(Number(result)).toBe(345);
  });

  it('bilinmeyen para birimi hata fırlatır', async () => {
    await expect(
      service.convert(new Decimal(1), 'XXX', 'TRY'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('kur yoksa fallback değer kullanılır', async () => {
    prisma.exchangeRate.findFirst.mockResolvedValue(null);

    const result = await service.orderAmountToTryForReport(
      new Decimal(250),
      'USD',
      new Date(),
      {
        currencyPreferManualRates: false,
        currencyTcmbEnabled: true,
        currencyManualRates: null,
      },
    );

    expect(result.usedDirect).toBe(true);
    expect(result.tryAmount).toBe(250);
  });
});
