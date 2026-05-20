import { OrgProductLine, type Prisma } from '@prisma/client';

/** Kayıt / onboarding ürün seçimi */
export type ProductSelection = 'ACCOUNTING' | 'INTEGRATION' | 'BUNDLE';

/** Satın alma paketi; DB'de genişletilerek INTEGRATION + ACCOUNTING olarak saklanır */
export type ProductBundle = 'BUNDLE';

export type ResolvedOrgProductLine = OrgProductLine;

const LINE_SET = new Set<string>(Object.values(OrgProductLine));
const DEFAULT_LINES: ResolvedOrgProductLine[] = [
  OrgProductLine.INTEGRATION,
  OrgProductLine.ACCOUNTING,
];

function isOrgProductLine(value: string): value is OrgProductLine {
  return LINE_SET.has(value);
}

/**
 * JSON alanından etkin ürün hatlarını çözümler.
 * null/eksik veya BUNDLE → her iki hat (mevcut müşteri davranışı).
 */
export function resolveOrgProductLines(raw: unknown): ResolvedOrgProductLine[] {
  if (raw == null) {
    return [...DEFAULT_LINES];
  }

  let entries: unknown[];
  if (Array.isArray(raw)) {
    entries = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [...DEFAULT_LINES];
    }
  } else {
    return [...DEFAULT_LINES];
  }

  const lines = new Set<ResolvedOrgProductLine>();
  for (const entry of entries) {
    if (typeof entry !== 'string') {
      continue;
    }
    const normalized = entry.trim().toUpperCase();
    if (normalized === 'BUNDLE') {
      lines.add(OrgProductLine.INTEGRATION);
      lines.add(OrgProductLine.ACCOUNTING);
      continue;
    }
    if (isOrgProductLine(normalized)) {
      lines.add(normalized);
    }
  }

  if (lines.size === 0) {
    return [...DEFAULT_LINES];
  }

  return [...lines];
}

export function orgHasProductLine(
  lines: readonly ResolvedOrgProductLine[],
  required: OrgProductLine,
): boolean {
  return lines.includes(required);
}

const LINE_ORDER: readonly OrgProductLine[] = [
  OrgProductLine.INTEGRATION,
  OrgProductLine.ACCOUNTING,
];

/** Mevcut hatlara tek bir ürün hattı ekler (sıralı, tekrarsız). */
export function mergeOrgProductLine(
  raw: unknown,
  lineToAdd: OrgProductLine,
): ResolvedOrgProductLine[] {
  const current = resolveOrgProductLines(raw);
  if (orgHasProductLine(current, lineToAdd)) {
    return current;
  }
  const merged = new Set(current);
  merged.add(lineToAdd);
  return LINE_ORDER.filter((line) => merged.has(line));
}

/** Admin org listesi — ürün hattı filtresi */
export type AdminOrgProductFilter = 'INTEGRATION' | 'ACCOUNTING' | 'BUNDLE';

export function adminOrgProductLineWhere(
  filter: AdminOrgProductFilter,
): Prisma.OrganizationWhereInput {
  switch (filter) {
    case 'INTEGRATION':
      return { productLines: { equals: ['INTEGRATION'] } };
    case 'ACCOUNTING':
      return { productLines: { equals: ['ACCOUNTING'] } };
    case 'BUNDLE':
      return {
        OR: [
          { productLines: { equals: ['BUNDLE'] } },
          { productLines: { equals: ['INTEGRATION', 'ACCOUNTING'] } },
        ],
      };
  }
}

/** Kayıt sırasında Organization.productLines JSON alanı için */
export function productSelectionToProductLines(
  selection?: ProductSelection,
): Prisma.InputJsonValue {
  if (selection == null) {
    return resolveOrgProductLines(null);
  }
  const token = selection === 'BUNDLE' ? 'BUNDLE' : selection;
  return resolveOrgProductLines([token]);
}
