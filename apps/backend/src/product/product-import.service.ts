import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, type Product, type ProductVariant } from '@prisma/client';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import type { ImportResult } from './product-import.types';
import { buildProductFilterWhere } from './product-query.util';
import type { ProductFilters } from './product.dto';
import { ProductVariantService } from './product-variant.service';
import type { BulkVariantItemDto } from './product-variant.dto';

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function parseDecimalInput(raw: string | undefined): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const s = raw.trim().replace(',', '.');
  if (!s) {
    return null;
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseIntInput(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === null || !raw.trim()) {
    return fallback;
  }
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseTags(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

const VARIANT_FIXED_HEADERS = new Set([
  'parentsku',
  'variantsku',
  'variantbarcode',
  'variantbarkod',
  'fiyat',
  'price',
  'stok',
  'stock',
  'gorsel',
  'görsel',
  'imageurl',
  'title',
  'baslik',
]);

function rowGet(
  row: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const nk = normalizeHeader(k);
    for (const [col, val] of Object.entries(row)) {
      if (normalizeHeader(col) === nk) {
        const v = val?.trim();
        if (v !== undefined && v.length > 0) {
          return v;
        }
      }
    }
  }
  return undefined;
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v === undefined || v === null ? '' : String(v);
  }
  return out;
}

@Injectable()
export class ProductImportService {
  private readonly logger = new Logger(ProductImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly productVariantService: ProductVariantService,
  ) {}

  async importProductsFromCsv(
    organizationId: string,
    csvBuffer: Buffer,
  ): Promise<ImportResult> {
    return this.importProductsFromFile(organizationId, csvBuffer, 'csv');
  }

  async importProductsFromFile(
    organizationId: string,
    file: Buffer,
    format: 'csv' | 'xlsx',
  ): Promise<ImportResult> {
    const rows = this.parseImportRows(file, format);
    return this.importProductRows(organizationId, rows);
  }

  private parseImportRows(
    file: Buffer,
    format: 'csv' | 'xlsx',
  ): Record<string, string>[] {
    if (format === 'csv') {
      const csv = file.toString('utf-8');
      const parsed = Papa.parse<Record<string, unknown>>(csv, {
        header: true,
        skipEmptyLines: 'greedy',
      });
      if (parsed.errors.length > 0) {
        this.logger.warn('CSV parse uyarıları', { count: parsed.errors.length });
      }
      return (parsed.data ?? []).map((row) => normalizeRowKeys(row));
    }

    const workbook = XLSX.read(file, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Excel dosyası boş');
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new BadRequestException('Excel sayfası okunamadı');
    }
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });
    return rawRows.map((row) => normalizeRowKeys(row));
  }

  private async importProductRows(
    organizationId: string,
    rows: Record<string, string>[],
  ): Promise<ImportResult> {
    const result: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    let lineNo = 1;
    for (const row of rows) {
      lineNo += 1;
      const sku = rowGet(row, ['sku']);
      const barcode = rowGet(row, ['barcode', 'barkod']);
      const title =
        rowGet(row, ['title', 'baslik', 'name', 'ad', 'urun', 'ürün']);
      if (!barcode?.trim() || !title?.trim()) {
        result.skipped += 1;
        continue;
      }
      try {
        const description = rowGet(row, ['description', 'aciklama', 'açıklama']);
        const brand = rowGet(row, ['brand', 'marka']);
        const category = rowGet(row, ['category', 'kategori']);
        const costRaw = rowGet(row, ['costprice', 'maliyet']);
        const tagsRaw = rowGet(row, ['tags', 'etiketler']);
        const imageUrl = rowGet(row, ['imageurl', 'gorsel', 'görsel']);

        const costPrice = parseDecimalInput(costRaw);
        const tags = parseTags(tagsRaw);

        const existingBySku =
          sku?.trim().length ?
            await this.prisma.product.findFirst({
              where: {
                organizationId,
                sku: sku.trim(),
                deletedAt: null,
              },
            })
          : null;

        const existingByBarcode = await this.prisma.product.findFirst({
          where: {
            organizationId,
            barcode: barcode.trim(),
            deletedAt: null,
          },
        });

        const existing = existingBySku ?? existingByBarcode;

        if (existing) {
          const imageUrls = [...(existing.imageUrls ?? [])];
          if (imageUrl && !imageUrls.includes(imageUrl)) {
            imageUrls.push(imageUrl);
          }
          await this.prisma.product.update({
            where: { id: existing.id },
            data: {
              name: title.trim(),
              ...(sku?.trim() ? { sku: sku.trim() } : {}),
              description: description?.trim() ?? null,
              brand: brand?.trim() ?? null,
              category: category?.trim() ?? null,
              costPrice:
                costPrice !== null ? new Prisma.Decimal(costPrice) : null,
              tags,
              imageUrls,
              deletedAt: null,
            },
          });
          result.updated += 1;
        } else {
          await this.prisma.product.create({
            data: {
              organizationId,
              barcode: barcode.trim(),
              sku: sku?.trim() || null,
              name: title.trim(),
              description: description?.trim() ?? null,
              brand: brand?.trim() ?? null,
              category: category?.trim() ?? null,
              costPrice:
                costPrice !== null ? new Prisma.Decimal(costPrice) : null,
              tags,
              imageUrls: imageUrl ? [imageUrl] : [],
            },
          });
          result.created += 1;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Bilinmeyen hata';
        result.errors.push(`Satır ${lineNo}: ${msg}`);
      }
    }

    await this.cache.invalidateProductsForOrg(organizationId);
    return result;
  }

  async importVariantsFromCsv(
    organizationId: string,
    productId: string,
    csvBuffer: Buffer,
  ): Promise<ImportResult> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
    });
    if (!product) {
      return {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: ['Ürün bulunamadı'],
      };
    }

    const csv = csvBuffer.toString('utf-8');
    const parsed = Papa.parse<Record<string, unknown>>(csv, {
      header: true,
      skipEmptyLines: 'greedy',
    });

    const result: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const bulk: BulkVariantItemDto[] = [];
    let lineNo = 1;
    for (const raw of parsed.data ?? []) {
      lineNo += 1;
      const row = normalizeRowKeys(raw);
      const variantSku = rowGet(row, ['variantsku', 'varyantsku', 'sku']);
      if (!variantSku?.trim()) {
        result.skipped += 1;
        continue;
      }
      const parentSku = rowGet(row, ['parentsku', 'ustsku', 'mastersku']);
      if (
        parentSku?.trim() &&
        parentSku.trim() !== (product.sku ?? '').trim() &&
        parentSku.trim() !== (product.barcode ?? '').trim()
      ) {
        result.errors.push(
          `Satır ${lineNo}: parentSku ürün ile eşleşmiyor (${parentSku.trim()}).`,
        );
        continue;
      }

      const variantBarcode = rowGet(row, ['variantbarcode', 'variantbarkod']);
      const priceRaw = rowGet(row, ['fiyat', 'price']);
      const stockRaw = rowGet(row, ['stok', 'stock']);
      const imageUrl = rowGet(row, ['gorsel', 'görsel', 'imageurl']);
      const titleOverride = rowGet(row, ['title', 'baslik', 'varyantbaslik']);

      const attrs: Record<string, string> = {};
      for (const [key, val] of Object.entries(row)) {
        const nk = normalizeHeader(key);
        if (VARIANT_FIXED_HEADERS.has(nk)) {
          continue;
        }
        const v = val.trim();
        if (v) {
          attrs[key.trim()] = v;
        }
      }

      const title =
        titleOverride?.trim() ||
        (Object.keys(attrs).length > 0
          ? Object.values(attrs).join(' / ')
          : variantSku.trim());

      bulk.push({
        sku: variantSku.trim(),
        barcode: variantBarcode?.trim() || null,
        title,
        attributes: attrs,
        price: parseDecimalInput(priceRaw),
        costPrice: null,
        stock: parseIntInput(stockRaw, 0),
        imageUrl: imageUrl?.trim() || null,
        isActive: true,
      });
    }

    if (bulk.length === 0) {
      return result;
    }

    try {
      const { created, updated } =
        await this.productVariantService.bulkUpsertVariants(
          organizationId,
          productId,
          bulk,
        );
      result.created = created;
      result.updated = updated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata';
      result.errors.push(msg);
    }

    return result;
  }

  async exportSimpleImportTemplateCsv(): Promise<string> {
    return (
      '\uFEFFbarcode,sku,name,category,salePrice,listPrice,stock,description\n' +
      '8690001,SKU-001,Örnek Ürün,Elektronik,199.90,299.90,50,Ürün açıklaması\n'
    );
  }

  async exportProductsBuffer(
    organizationId: string,
    format: 'csv' | 'xlsx',
    filters?: ProductFilters & { productIds?: string[] },
  ): Promise<Buffer> {
    const where = {
      ...buildProductFilterWhere(organizationId, filters ?? {}),
      ...(filters?.productIds?.length ? { id: { in: filters.productIds } } : {}),
    };

    const products = await this.prisma.product.findMany({
      where,
      include: {
        variants: { where: { deletedAt: null } },
        listings: {
          where: { deletedAt: null },
          select: { salePrice: true, listPrice: true },
          take: 1,
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = products.map((p) => {
      const listing = p.listings[0];
      const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
      return {
        barcode: p.barcode,
        sku: p.sku ?? '',
        name: p.name,
        category: p.category ?? '',
        categoryId: p.categoryId ?? '',
        salePrice: listing?.salePrice?.toString() ?? '',
        listPrice: listing?.listPrice?.toString() ?? '',
        stock: String(stock),
        description: p.description ?? '',
        brand: p.brand ?? '',
        costPrice: p.costPrice?.toString() ?? '',
        isActive: p.isActive ? 'true' : 'false',
      };
    });

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Urunler');
      return Buffer.from(
        XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
      );
    }

    const csv = Papa.unparse(rows, { header: true });
    const body = csv.startsWith('\uFEFF') ? csv : `\uFEFF${csv}`;
    return Buffer.from(body, 'utf-8');
  }

  async exportProductsToCsv(
    organizationId: string,
    options?: { productIds?: string[]; columns?: string[] },
  ): Promise<string> {
    const defaultColumns = [
      'barcode',
      'sku',
      'name',
      'category',
      'salePrice',
      'listPrice',
      'stock',
      'description',
      'brand',
      'costPrice',
    ];
    const columns =
      options?.columns?.length && options.columns.length > 0
        ? options.columns
        : defaultColumns;

    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(options?.productIds?.length
          ? { id: { in: options.productIds } }
          : {}),
      },
      include: {
        variants: { where: { deletedAt: null } },
        listings: {
          where: { deletedAt: null },
          select: { salePrice: true, listPrice: true },
          take: 1,
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (options?.columns?.length) {
      const lines = [columns.join(',')];
      for (const p of products) {
        const listing = p.listings[0];
        const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
        const rowMap: Record<string, string> = {
          barcode: p.barcode ?? '',
          sku: p.sku ?? '',
          name: p.name,
          category: p.category ?? '',
          salePrice: listing?.salePrice?.toString() ?? '',
          listPrice: listing?.listPrice?.toString() ?? '',
          stock: String(stock),
          description: p.description ?? '',
          brand: p.brand ?? '',
          costPrice: p.costPrice?.toString() ?? '',
        };
        lines.push(
          columns
            .map((col) => this.escapeCsvField(rowMap[col] ?? ''))
            .join(','),
        );
      }
      return lines.join('\n');
    }

    const productHeader = [
      'sku',
      'barcode',
      'title',
      'description',
      'brand',
      'category',
      'costPrice',
      'tags',
      'imageUrl',
    ];
    const variantHeader = [
      'parentSku',
      'variantSku',
      'variantBarcode',
      'Renk',
      'Beden',
      'Fiyat',
      'Stok',
      'Görsel',
    ];

    const productRows: string[][] = [];
    const variantRows: string[][] = [];

    for (const p of products) {
      productRows.push(this.productToCsvRow(p, productHeader));
      const parentSku = (p.sku ?? p.barcode ?? '').trim();
      for (const v of p.variants) {
        variantRows.push(this.variantToCsvRow(p, v, parentSku, variantHeader));
      }
    }

    const lines: string[] = [];
    lines.push(productHeader.join(','));
    for (const r of productRows) {
      lines.push(r.map((c) => this.escapeCsvField(c)).join(','));
    }
    lines.push('');
    lines.push(variantHeader.join(','));
    for (const r of variantRows) {
      lines.push(r.map((c) => this.escapeCsvField(c)).join(','));
    }
    return lines.join('\n');
  }

  async exportProductTemplateCsv(): Promise<string> {
    const productHeader =
      'sku,barcode,title,description,brand,category,costPrice,tags,imageUrl';
    const productSample =
      'ORNEK-SKU,8680000000000,Örnek ürün,Kısa açıklama,Örnek Marka,Elektronik,99.90,"yaz,kış",https://ornek.com/urun.jpg';
    const variantHeader =
      'parentSku,variantSku,variantBarcode,Renk,Beden,Fiyat,Stok,Görsel';
    const variantSample =
      'ORNEK-SKU,ORNEK-SKU-KRM-XL,8680000000001,Kırmızı,XL,129.90,12,https://ornek.com/v1.jpg';
    return `\uFEFF${productHeader}\n${productSample}\n\n${variantHeader}\n${variantSample}\n`;
  }

  private productToCsvRow(p: Product, header: string[]): string[] {
    const map: Record<string, string> = {
      sku: p.sku ?? '',
      barcode: p.barcode ?? '',
      title: p.name,
      description: p.description ?? '',
      brand: p.brand ?? '',
      category: p.category ?? '',
      costPrice: p.costPrice?.toString() ?? '',
      tags: (p.tags ?? []).join(';'),
      imageUrl: (p.imageUrls ?? [])[0] ?? '',
    };
    return header.map((h) => map[h] ?? '');
  }

  private variantToCsvRow(
    _p: Product,
    v: ProductVariant,
    parentSku: string,
    header: string[],
  ): string[] {
    const attrs = v.attributes as Record<string, unknown>;
    const str = (k: string): string => {
      const raw = attrs[k];
      return typeof raw === 'string' ? raw : '';
    };
    const map: Record<string, string> = {
      parentSku,
      variantSku: v.sku,
      variantBarcode: v.barcode ?? '',
      Renk: str('Renk') || str('renk'),
      Beden: str('Beden') || str('beden'),
      Fiyat: v.price?.toString() ?? '',
      Stok: String(v.stock),
      Görsel: v.imageUrl ?? '',
    };
    return header.map((h) => map[h] ?? '');
  }

  private escapeCsvField(value: string): string {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
