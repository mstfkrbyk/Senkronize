import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

export interface ProductBarcodeSearchResult {
  id: string;
  barcode: string | null;
  name: string;
  sku: string | null;
  brand: string | null;
  category: string | null;
}

@Injectable()
export class BarcodeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Organizasyon bazlı 3 haneli EAN-13 önek (200–899 aralığı). */
  orgPrefix(organizationId: string): string {
    const hash = createHash('sha256').update(organizationId).digest();
    const num = 200 + (hash.readUInt16BE(0) % 700);
    return String(num).padStart(3, '0');
  }

  /** EAN-13 kontrol basamağını hesaplar. */
  computeCheckDigit(digits12: string): string {
    if (!/^\d{12}$/.test(digits12)) {
      throw new BadRequestException('Geçersiz barkod gövdesi.');
    }
    let sum = 0;
    for (let i = 0; i < 12; i += 1) {
      const d = Number.parseInt(digits12[i] ?? '0', 10);
      sum += i % 2 === 0 ? d : d * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return String(check);
  }

  validateBarcode(barcode: string): boolean {
    const trimmed = barcode.trim();
    if (!/^\d{13}$/.test(trimmed)) {
      return false;
    }
    const body = trimmed.slice(0, 12);
    const check = trimmed.slice(12);
    return this.computeCheckDigit(body) === check;
  }

  private buildEan13(organizationId: string, sequence: number): string {
    const prefix = this.orgPrefix(organizationId);
    const body = `${prefix}${String(sequence).padStart(9, '0').slice(-9)}`;
    return `${body}${this.computeCheckDigit(body)}`;
  }

  async generateBarcode(
    organizationId: string,
    productId: string,
  ): Promise<{ barcode: string }> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı.');
    }
    if ((product.barcode ?? '').trim().length > 0) {
      const existingValid = this.validateBarcode(product.barcode!);
      if (existingValid) {
        return { barcode: product.barcode! };
      }
    }

    const count = await this.prisma.product.count({
      where: { organizationId, deletedAt: null },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = this.buildEan13(organizationId, count + attempt + 1);
      const clash = await this.prisma.product.findFirst({
        where: { organizationId, barcode: candidate, deletedAt: null },
        select: { id: true },
      });
      if (clash && clash.id !== productId) {
        continue;
      }
      await this.prisma.product.update({
        where: { id: productId },
        data: { barcode: candidate },
      });
      return { barcode: candidate };
    }

    throw new ConflictException('Benzersiz barkod üretilemedi.');
  }

  async searchByBarcode(
    organizationId: string,
    barcode: string,
  ): Promise<{ data: ProductBarcodeSearchResult | null }> {
    const trimmed = barcode.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Barkod boş olamaz.');
    }

    const product = await this.prisma.product.findFirst({
      where: { organizationId, barcode: trimmed, deletedAt: null },
      select: {
        id: true,
        barcode: true,
        name: true,
        sku: true,
        brand: true,
        category: true,
      },
    });
    if (product) {
      return { data: product };
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: { organizationId, barcode: trimmed, deletedAt: null },
      include: {
        product: {
          select: {
            id: true,
            barcode: true,
            name: true,
            sku: true,
            brand: true,
            category: true,
            deletedAt: true,
          },
        },
      },
    });
    if (variant?.product && variant.product.deletedAt === null) {
      return {
        data: {
          id: variant.product.id,
          barcode: trimmed,
          name: variant.title || variant.product.name,
          sku: variant.sku,
          brand: variant.product.brand,
          category: variant.product.category,
        },
      };
    }

    return { data: null };
  }

  async generateVariantBarcodes(
    organizationId: string,
    productId: string,
    variantIds: string[],
  ): Promise<{ updated: number; barcodes: Record<string, string> }> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı.');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: {
        organizationId,
        productId,
        deletedAt: null,
        id: { in: variantIds },
      },
      select: { id: true, barcode: true },
      orderBy: { createdAt: 'asc' },
    });

    const variantCount = await this.prisma.productVariant.count({
      where: { organizationId, deletedAt: null },
    });
    const productCount = await this.prisma.product.count({
      where: { organizationId, deletedAt: null },
    });
    let sequence = productCount + variantCount;

    const barcodes: Record<string, string> = {};
    let updated = 0;

    for (const variant of variants) {
      if (variant.barcode?.trim()) {
        barcodes[variant.id] = variant.barcode;
        continue;
      }

      for (let attempt = 0; attempt < 20; attempt += 1) {
        sequence += 1;
        const candidate = this.buildEan13(organizationId, sequence);
        const productClash = await this.prisma.product.findFirst({
          where: { organizationId, barcode: candidate, deletedAt: null },
          select: { id: true },
        });
        const variantClash = await this.prisma.productVariant.findFirst({
          where: {
            organizationId,
            barcode: candidate,
            deletedAt: null,
            id: { not: variant.id },
          },
          select: { id: true },
        });
        if (productClash || variantClash) {
          continue;
        }
        await this.prisma.productVariant.update({
          where: { id: variant.id },
          data: { barcode: candidate },
        });
        barcodes[variant.id] = candidate;
        updated += 1;
        break;
      }
    }

    return { updated, barcodes };
  }
}
