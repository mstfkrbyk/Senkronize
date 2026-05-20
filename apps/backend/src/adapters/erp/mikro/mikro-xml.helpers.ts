import { XMLParser } from 'fast-xml-parser';

import { isRecord } from '../erp-adapter.utils';

import type { MikroStokRow } from './mikro.types';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlElement(name: string, value: string | number | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }
  const text = String(value);
  if (text.length === 0) {
    return '';
  }
  return `<${name}>${escapeXml(text)}</${name}>`;
}

/** Düz anahtar-değer çiftlerinden Mikro XML istek gövdesi üretir */
export function buildMikroXml(fields: Record<string, string | number | undefined>): string {
  const inner = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
    .map(([key, value]) => xmlElement(key, value))
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><request>${inner}</request>`;
}

/** Token + firma + data alt alanları ile standart Mikro isteği */
export function buildMikroDataRequest(
  token: string,
  firmaKodu: string,
  dataFields: Record<string, string | number | undefined>,
): string {
  const dataInner = Object.entries(dataFields)
    .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
    .map(([key, value]) => xmlElement(key, value))
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><request>${xmlElement('token', token)}${xmlElement('firma', firmaKodu)}<data>${dataInner}</data></request>`;
}

export function parseMikroXml(xml: string): unknown {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    removeNSPrefix: true,
  });
  return parser.parse(xml) as unknown;
}

export function extractMikroToken(parsed: unknown): string | null {
  if (!isRecord(parsed)) {
    return null;
  }
  const root = parsed.request ?? parsed.response ?? parsed;
  const node = isRecord(root) ? root : parsed;
  const token =
    (typeof node.token === 'string' && node.token) ||
    (typeof node.Token === 'string' && node.Token) ||
    (typeof node.accessToken === 'string' && node.accessToken) ||
    null;
  return token && token.length > 0 ? token : null;
}

function collectStokRows(node: unknown, acc: MikroStokRow[]): void {
  if (node === null || node === undefined) {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectStokRows(item, acc);
    }
    return;
  }
  if (!isRecord(node)) {
    return;
  }
  const hasStokShape =
    node.stokKod !== undefined ||
    node.stokKodu !== undefined ||
    node.StokKod !== undefined ||
    node.StokKodu !== undefined ||
    node.code !== undefined ||
    node.Code !== undefined;
  if (hasStokShape) {
    acc.push(node as MikroStokRow);
    return;
  }
  for (const value of Object.values(node)) {
    if (typeof value === 'object' && value !== null) {
      collectStokRows(value, acc);
    }
  }
}

export function extractMikroStokRows(parsed: unknown): MikroStokRow[] {
  const acc: MikroStokRow[] = [];
  if (!isRecord(parsed)) {
    return acc;
  }
  const root = parsed.response ?? parsed.request ?? parsed;
  collectStokRows(root, acc);
  return acc;
}

export function resolveMikroFirmaKodu(credentials: Record<string, string>): string {
  return (
    credentials.firmaKodu?.trim() ||
    credentials.firmaNo?.trim() ||
    credentials.firmNo?.trim() ||
    credentials.dbName?.trim() ||
    '1'
  );
}
