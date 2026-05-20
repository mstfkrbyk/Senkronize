import { BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

import type { MigrationSourceFormat } from './migration.types';

export interface ParsedMigrationFile {
  headers: string[];
  rows: Record<string, string>[];
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v === undefined || v === null ? '' : String(v);
  }
  return out;
}

function rowsFromObjects(objects: Record<string, unknown>[]): ParsedMigrationFile {
  if (objects.length === 0) {
    return { headers: [], rows: [] };
  }
  const headerSet = new Set<string>();
  for (const obj of objects) {
    for (const key of Object.keys(obj)) {
      headerSet.add(key);
    }
  }
  const headers = [...headerSet];
  const rows = objects.map((obj) => {
    const row: Record<string, string> = {};
    for (const h of headers) {
      const val = obj[h];
      row[h] = val === undefined || val === null ? '' : String(val);
    }
    return row;
  });
  return { headers, rows };
}

function parseCsvBuffer(buffer: Buffer): ParsedMigrationFile {
  const text = buffer.toString('utf-8');
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length > 0) {
    throw new BadRequestException('CSV dosyası okunamadı');
  }
  const rows = (parsed.data ?? []).map(normalizeRowKeys);
  const headers =
    parsed.meta.fields?.map((h) => h.trim()) ??
    (rows[0] ? Object.keys(rows[0]) : []);
  return { headers, rows };
}

function parseExcelBuffer(buffer: Buffer): ParsedMigrationFile {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });
  return rowsFromObjects(json);
}

function parseJsonBuffer(buffer: Buffer): ParsedMigrationFile {
  const text = buffer.toString('utf-8');
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    throw new BadRequestException('Geçersiz JSON dosyası');
  }
  if (Array.isArray(data)) {
    const objects = data.filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    );
    return rowsFromObjects(objects);
  }
  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    for (const key of ['products', 'orders', 'items', 'data', 'urunler', 'siparisler']) {
      const nested = record[key];
      if (Array.isArray(nested)) {
        const objects = nested.filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null,
        );
        return rowsFromObjects(objects);
      }
    }
    return rowsFromObjects([record]);
  }
  throw new BadRequestException('JSON kök yapısı desteklenmiyor');
}

function parseWooCommerceXml(buffer: Buffer): ParsedMigrationFile {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const parsed = parser.parse(buffer.toString('utf-8')) as Record<string, unknown>;
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = (rss?.channel ?? parsed.channel) as Record<string, unknown> | undefined;
  const itemsRaw = channel?.item;
  const items = Array.isArray(itemsRaw)
    ? itemsRaw
    : itemsRaw
      ? [itemsRaw]
      : [];

  const rows: Record<string, string>[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v === 'object' && v !== null) {
        row[k] = JSON.stringify(v);
      } else {
        row[k] = v === undefined || v === null ? '' : String(v);
      }
    }
    const title = row['title'] ?? row['post_title'] ?? '';
    const sku =
      row['_sku'] ??
      row['wp:meta_value'] ??
      row['sku'] ??
      '';
    row['post_title'] = title;
    row['_sku'] = sku;
    rows.push(row);
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];
  return { headers, rows };
}

export function parseMigrationFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  sourceFormat: MigrationSourceFormat,
): ParsedMigrationFile {
  const lower = fileName.toLowerCase();

  if (sourceFormat === 'woocommerce_xml' || lower.endsWith('.xml')) {
    return parseWooCommerceXml(buffer);
  }

  if (
    sourceFormat === 'generic_excel' ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls')
  ) {
    return parseExcelBuffer(buffer);
  }

  if (
    sourceFormat === 'generic_json' ||
    sourceFormat === 'entegra_json' ||
    sourceFormat === 'kolay_ik_json' ||
    lower.endsWith('.json')
  ) {
    return parseJsonBuffer(buffer);
  }

  return parseCsvBuffer(buffer);
}
