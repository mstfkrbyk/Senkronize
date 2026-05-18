import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { XMLParser } from 'fast-xml-parser';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import {
  CURRENCY_LATEST_CACHE_KEY,
  CURRENCY_LATEST_CACHE_TTL_SEC,
  SUPPORTED_CURRENCIES,
  TCMB_TODAY_XML,
} from './currency.constants';

const BASE = 'TRY';

function istanbulYmd(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

function istanbulDayBoundsFor(date: Date): { start: Date; end: Date } {
  const ymd = istanbulYmd(date);
  return {
    start: new Date(`${ymd}T00:00:00+03:00`),
    end: new Date(`${ymd}T23:59:59.999+03:00`),
  };
}

function parseTcmbNumber(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === '') {
    return null;
  }
  const normalized = raw.trim().replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeManualRates(raw: Prisma.JsonValue | null): Record<
  string,
  number
> | null {
  if (raw == null || (raw as unknown) === Prisma.JsonNull) {
    return null;
  }
  if (!isRecord(raw)) {
    return null;
  }
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(raw)) {
    const code = k.trim().toUpperCase();
    if (code.length !== 3) {
      continue;
    }
    const n = typeof val === 'number' ? val : Number(val);
    if (Number.isFinite(n) && n > 0) {
      out[code] = n;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

interface OrgCurrencyPrefs {
  currencyPreferManualRates: boolean;
  currencyTcmbEnabled: boolean;
  currencyManualRates: Prisma.JsonValue | null;
}

const DEFAULT_PREFS: OrgCurrencyPrefs = {
  currencyPreferManualRates: false,
  currencyTcmbEnabled: true,
  currencyManualRates: null,
};

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Raporlar için organizasyon kur tercihleri (tek sorgu). */
  async getOrgCurrencyPrefs(organizationId: string): Promise<OrgCurrencyPrefs> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        currencyPreferManualRates: true,
        currencyTcmbEnabled: true,
        currencyManualRates: true,
      },
    });
    if (!org) {
      return { ...DEFAULT_PREFS };
    }
    return {
      currencyPreferManualRates: org.currencyPreferManualRates,
      currencyTcmbEnabled: org.currencyTcmbEnabled,
      currencyManualRates: org.currencyManualRates,
    };
  }

  getSupportedCurrencies(): string[] {
    return [...SUPPORTED_CURRENCIES];
  }

  /** TCMB günlük kurları çek ve veritabanına kaydet */
  async fetchTCMBRates(): Promise<void> {
    const res = await fetch(TCMB_TODAY_XML);
    if (!res.ok) {
      throw new Error(`TCMB yanıt kodu: ${String(res.status)}`);
    }
    const xml = await res.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const parsed: unknown = parser.parse(xml);
    if (!isRecord(parsed)) {
      throw new Error('TCMB XML beklenen yapıda değil');
    }
    let bucket: Record<string, unknown> = parsed;
    if (isRecord(parsed.Tarih_Date)) {
      bucket = parsed.Tarih_Date as Record<string, unknown>;
    }
    const rawCurrencies = bucket.Currency;
    const list: unknown[] = Array.isArray(rawCurrencies)
      ? rawCurrencies
      : rawCurrencies != null
        ? [rawCurrencies]
        : [];

    const fetchedAt = new Date();
    const rows: Prisma.ExchangeRateCreateManyInput[] = [];

    for (const item of list) {
      if (!isRecord(item)) {
        continue;
      }
      const kodRaw = item['@_Kod'] ?? item['@_CurrencyCode'];
      const kod =
        typeof kodRaw === 'string'
          ? kodRaw.trim().toUpperCase()
          : typeof item.CurrencyCode === 'string'
            ? item.CurrencyCode.trim().toUpperCase()
            : '';
      if (kod.length !== 3 || kod === BASE) {
        continue;
      }
      if (!this.getSupportedCurrencies().includes(kod)) {
        continue;
      }
      const forexSelling =
        typeof item.ForexSelling === 'string'
          ? item.ForexSelling
          : typeof item.ForexSelling === 'number'
            ? String(item.ForexSelling)
            : typeof item.BanknoteSelling === 'string'
              ? item.BanknoteSelling
              : undefined;
      const rate = parseTcmbNumber(forexSelling);
      if (rate == null) {
        continue;
      }
      rows.push({
        baseCurrency: BASE,
        targetCurrency: kod,
        rate,
        source: 'TCMB',
        fetchedAt,
      });
    }

    if (rows.length === 0) {
      this.logger.warn('TCMB kurlarından kayıt üretilemedi');
      return;
    }

    await this.prisma.exchangeRate.createMany({
      data: rows,
      skipDuplicates: true,
    });

    const latest: Record<string, number> = {};
    for (const r of rows) {
      latest[r.targetCurrency] = Number(r.rate);
    }
    await this.cache.set(
      CURRENCY_LATEST_CACHE_KEY,
      latest,
      CURRENCY_LATEST_CACHE_TTL_SEC,
    );
  }

  /** Redis + DB birleşik son kurlar (1 yabancı = X TRY) */
  async getLatestRates(): Promise<Record<string, number>> {
    const cached = await this.cache.get<Record<string, number>>(
      CURRENCY_LATEST_CACHE_KEY,
    );
    if (cached && Object.keys(cached).length > 0) {
      return cached;
    }

    const rows = await this.prisma.$queryRaw<
      { targetCurrency: string; rate: Prisma.Decimal }[]
    >`
      SELECT DISTINCT ON ("targetCurrency") "targetCurrency", rate
      FROM "ExchangeRate"
      WHERE "baseCurrency" = ${BASE}
      ORDER BY "targetCurrency", "fetchedAt" DESC
    `;

    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.targetCurrency] = Number(r.rate);
    }
    if (Object.keys(map).length > 0) {
      await this.cache.set(
        CURRENCY_LATEST_CACHE_KEY,
        map,
        CURRENCY_LATEST_CACHE_TTL_SEC,
      );
    }
    return map;
  }

  async convert(
    amount: Decimal,
    from: string,
    to: string,
    date?: Date,
    organizationId?: string,
  ): Promise<Decimal> {
    const fromC = from.trim().toUpperCase();
    const toC = to.trim().toUpperCase();
    this.assertCurrency(fromC);
    this.assertCurrency(toC);
    const amt = new Decimal(amount);
    if (fromC === toC) {
      return amt;
    }
    const asOf = date ?? new Date();
    const prefs = organizationId
      ? await this.getOrgCurrencyPrefs(organizationId)
      : { ...DEFAULT_PREFS };

    const inTry = await this.toTryDecimal(amt, fromC, asOf, prefs);
    if (toC === BASE) {
      return inTry;
    }
    const toPerTry = await this.resolveTryPerUnit(
      toC,
      asOf,
      prefs,
      true,
    );
    if (toPerTry == null || toPerTry <= 0) {
      throw new BadRequestException(
        `${toC} için kur bulunamadı. Lütfen TCMB senkronunu veya manuel kurları kontrol edin.`,
      );
    }
    return inTry.div(toPerTry);
  }

  /**
   * Raporlarda kullanılır: kur yoksa ham tutarı TRY sanarak geri döner (`usedDirect=true`).
   */
  async orderAmountToTryForReport(
    amount: Decimal,
    currency: string,
    orderDate: Date,
    prefs: OrgCurrencyPrefs,
  ): Promise<{ tryAmount: number; usedDirect: boolean }> {
    const cur = currency.trim().toUpperCase();
    if (cur === BASE) {
      return { tryAmount: Number(amount), usedDirect: false };
    }
    const perTry = await this.resolveTryPerUnit(cur, orderDate, prefs, true);
    if (perTry == null || perTry <= 0) {
      return { tryAmount: Number(amount), usedDirect: true };
    }
    return { tryAmount: Number(amount.mul(perTry)), usedDirect: false };
  }

  /**
   * Sipariş tutarını TRY'ye çevirir (kur: sipariş anının İstanbul gününe göre).
   */
  async orderAmountToTry(
    amount: Decimal,
    currency: string,
    orderDate: Date,
    organizationId: string,
    prefs?: OrgCurrencyPrefs,
  ): Promise<number> {
    const cur = currency.trim().toUpperCase();
    if (cur === BASE) {
      return Number(amount);
    }
    const p = prefs ?? (await this.getOrgCurrencyPrefs(organizationId));
    const d = await this.toTryDecimal(new Decimal(amount), cur, orderDate, p);
    return Number(d);
  }

  private assertCurrency(code: string): void {
    if (!this.getSupportedCurrencies().includes(code)) {
      throw new BadRequestException(`Desteklenmeyen para birimi: ${code}`);
    }
  }

  private async toTryDecimal(
    amount: Decimal,
    fromCurrency: string,
    asOf: Date,
    prefs: OrgCurrencyPrefs,
  ): Promise<Decimal> {
    if (fromCurrency === BASE) {
      return amount;
    }
    const perTry = await this.resolveTryPerUnit(
      fromCurrency,
      asOf,
      prefs,
      true,
    );
    if (perTry == null || perTry <= 0) {
      throw new BadRequestException(
        `${fromCurrency} için kur bulunamadı. Lütfen ayarlardan manuel kur girin veya TCMB verisini bekleyin.`,
      );
    }
    return amount.mul(perTry);
  }

  /**
   * 1 `targetCurrency` biriminin TRY karşılığı (yoksa null).
   */
  async resolveTryPerUnit(
    targetCurrency: string,
    asOf: Date,
    prefs: OrgCurrencyPrefs | null,
    allowDbFallback: boolean,
  ): Promise<number | null> {
    const effective = prefs ?? DEFAULT_PREFS;
    const code = targetCurrency.trim().toUpperCase();
    if (code === BASE) {
      return 1;
    }
    const manualAll = normalizeManualRates(effective.currencyManualRates);
    const manualRate = manualAll?.[code] ?? null;

    const preferManual = effective.currencyPreferManualRates === true;
    const tcmbEnabled = effective.currencyTcmbEnabled !== false;

    if (preferManual && manualRate != null) {
      return manualRate;
    }

    if (tcmbEnabled && allowDbFallback) {
      const db = await this.findTryPerUnitFromDb(code, asOf);
      if (db != null) {
        return db;
      }
    }

    if (manualRate != null) {
      return manualRate;
    }

    if (allowDbFallback) {
      return this.findTryPerUnitFromDb(code, asOf);
    }
    return null;
  }

  private async findTryPerUnitFromDb(
    target: string,
    asOf: Date,
  ): Promise<number | null> {
    const { start, end } = istanbulDayBoundsFor(asOf);
    const sameDay = await this.prisma.exchangeRate.findFirst({
      where: {
        baseCurrency: BASE,
        targetCurrency: target,
        fetchedAt: { gte: start, lte: end },
      },
      orderBy: { fetchedAt: 'desc' },
    });
    if (sameDay) {
      return Number(sameDay.rate);
    }
    const fallback = await this.prisma.exchangeRate.findFirst({
      where: {
        baseCurrency: BASE,
        targetCurrency: target,
        fetchedAt: { lte: asOf },
      },
      orderBy: { fetchedAt: 'desc' },
    });
    return fallback ? Number(fallback.rate) : null;
  }
}
