import { Marketplace } from '@prisma/client';

import type {
  CustomerImportDto,
  OrderImportDto,
  ProductImportDto,
  StockMovementImportDto,
} from './migration.import-dto';
import type {
  MigrationDataType,
  MigrationFieldIssue,
  MigrationValidationResult,
} from './migration.types';
import { transformRow } from './transformers';
import type { MigrationSourceFormat } from './migration.types';
import { applyColumnMapping } from './migration.mapper';

function isValidMarketplace(value: string): boolean {
  return Object.values(Marketplace).includes(value as Marketplace);
}

function validateProduct(
  dto: ProductImportDto,
  rowIndex: number,
): { errors: MigrationFieldIssue[]; warnings: MigrationFieldIssue[] } {
  const errors: MigrationFieldIssue[] = [];
  const warnings: MigrationFieldIssue[] = [];

  if (!dto.name?.trim()) {
    errors.push({ row: rowIndex, field: 'name', message: 'Ürün adı boş olamaz' });
  }
  if (!dto.barcode?.trim() && !dto.sku?.trim()) {
    errors.push({
      row: rowIndex,
      field: 'sku',
      message: 'SKU veya barkod boş olamaz',
    });
  }
  if (dto.price < 0 || !Number.isFinite(dto.price)) {
    errors.push({
      row: rowIndex,
      field: 'price',
      message: 'Geçersiz fiyat formatı',
    });
  }
  if (dto.category?.trim()) {
    warnings.push({
      row: rowIndex,
      field: 'category',
      message: 'Kategori bulunamadı, oluşturulacak',
    });
  }

  return { errors, warnings };
}

function validateOrder(
  dto: OrderImportDto,
  rowIndex: number,
): { errors: MigrationFieldIssue[]; warnings: MigrationFieldIssue[] } {
  const errors: MigrationFieldIssue[] = [];
  const warnings: MigrationFieldIssue[] = [];

  if (!dto.platformOrderId?.trim()) {
    errors.push({
      row: rowIndex,
      field: 'platformOrderId',
      message: 'Sipariş numarası gerekli',
    });
  }
  if (!dto.customerName?.trim()) {
    errors.push({
      row: rowIndex,
      field: 'customerName',
      message: 'Müşteri adı gerekli',
    });
  }
  if (!isValidMarketplace(dto.platform)) {
    warnings.push({
      row: rowIndex,
      field: 'platform',
      message: `Platform "${dto.platform}" tanınmadı, TRENDYOL kullanılacak`,
    });
  }
  if (dto.totalAmount < 0 || !Number.isFinite(dto.totalAmount)) {
    errors.push({
      row: rowIndex,
      field: 'totalAmount',
      message: 'Geçersiz tutar',
    });
  }

  return { errors, warnings };
}

function validateCustomer(
  dto: CustomerImportDto,
  rowIndex: number,
): { errors: MigrationFieldIssue[]; warnings: MigrationFieldIssue[] } {
  const errors: MigrationFieldIssue[] = [];
  const warnings: MigrationFieldIssue[] = [];

  if (!dto.name?.trim()) {
    errors.push({ row: rowIndex, field: 'name', message: 'Müşteri adı gerekli' });
  }
  if (dto.email && !dto.email.includes('@')) {
    errors.push({
      row: rowIndex,
      field: 'email',
      message: 'Geçersiz e-posta formatı',
    });
  }
  if (dto.platform && !isValidMarketplace(dto.platform.toUpperCase())) {
    warnings.push({
      row: rowIndex,
      field: 'platform',
      message: 'Platform tanınmadı, kayıt platformsuz oluşturulacak',
    });
  }

  return { errors, warnings };
}

function validateStockMovement(
  dto: StockMovementImportDto,
  rowIndex: number,
): { errors: MigrationFieldIssue[]; warnings: MigrationFieldIssue[] } {
  const errors: MigrationFieldIssue[] = [];
  const warnings: MigrationFieldIssue[] = [];

  if (!dto.barcode?.trim()) {
    errors.push({
      row: rowIndex,
      field: 'barcode',
      message: 'Barkod gerekli',
    });
  }
  if (dto.quantity <= 0) {
    errors.push({
      row: rowIndex,
      field: 'quantity',
      message: 'Miktar sıfırdan büyük olmalı',
    });
  }

  return { errors, warnings };
}

export function validateMigrationRows(
  rawRows: Record<string, string>[],
  columnMapping: Record<string, string>,
  sourceFormat: MigrationSourceFormat,
  dataType: MigrationDataType,
): MigrationValidationResult {
  const errors: MigrationFieldIssue[] = [];
  const warnings: MigrationFieldIssue[] = [];
  let valid = 0;

  rawRows.forEach((raw, index) => {
    const rowIndex = index + 2;
    const mapped = applyColumnMapping(raw, columnMapping);
    const normalized = transformRow(sourceFormat, dataType, mapped);

    let result: { errors: MigrationFieldIssue[]; warnings: MigrationFieldIssue[] };

    switch (dataType) {
      case 'products':
        result = validateProduct(normalized as ProductImportDto, rowIndex);
        break;
      case 'orders':
        result = validateOrder(normalized as OrderImportDto, rowIndex);
        break;
      case 'customers':
        result = validateCustomer(normalized as CustomerImportDto, rowIndex);
        break;
      case 'stock_movements':
        result = validateStockMovement(
          normalized as StockMovementImportDto,
          rowIndex,
        );
        break;
      default:
        result = { errors: [], warnings: [] };
    }

    if (result.errors.length === 0) {
      valid++;
    }
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  });

  return {
    total: rawRows.length,
    valid,
    errors,
    warnings,
  };
}
