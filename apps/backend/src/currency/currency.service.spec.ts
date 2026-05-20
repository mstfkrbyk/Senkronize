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

  it('aynı para birimi için tutarı değiştirmeden döner', async () => {
    const amount = new Decimal(125.75);
    const result = await service.convert(amount, 'TRY', 'TRY');
    expect(Number(result)).toBe(125.75);
  });

  it('USD → TRY dönüşümü rate * amount döner', async () => {
    const rate = 34.5;
    const amount = 10;
    prisma.organization.findFirst.mockResolvedValue({
      currencyPreferManualRates: true,
      currencyTcmbEnabled: false,
      currencyManualRates: { USD: rate },
    });

    const result = await service.convert(
      new Decimal(amount),
      'USD',
      'TRY',
      new Date(),
      'org-1',
    );

    expect(Number(result)).toBe(rate * amount);
  });

  it('bilinmeyen para birimi için fallback kullanır', async () => {
    prisma.exchangeRate.findFirst.mockResolvedValue(null);

    const amount = 250;
    const result = await service.orderAmountToTryForReport(
      new Decimal(amount),
      'USD',
      new Date(),
      {
        currencyPreferManualRates: false,
        currencyTcmbEnabled: true,
        currencyManualRates: null,
      },
    );

    expect(result.usedDirect).toBe(true);
    expect(result.tryAmount).toBe(amount);
  });

  it('desteklenmeyen para birimi hata fırlatır', async () => {
    await expect(
      service.convert(new Decimal(1), 'XXX', 'TRY'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
