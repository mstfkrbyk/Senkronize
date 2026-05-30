import type { ConnectionFormFieldDef } from '@/lib/connection-form-field.types';
import { isValidHttpOrHttpsUrl } from '@/lib/form-messages';

/** Form alanları boş başlar; yalnızca select için varsayılan seçim uygulanır. */
export function emptyConnectionFormValues(
  fields: ConnectionFormFieldDef[],
): Record<string, string> {
  return Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.type === 'select' && f.defaultValue !== undefined ? String(f.defaultValue) : '',
    ]),
  );
}

/** Boş bırakılan alanlara tanımdaki defaultValue uygulanır (gönderim / test öncesi). */
export function applyConnectionFieldDefaults(
  fields: ConnectionFormFieldDef[],
  values: Record<string, string>,
): Record<string, string> {
  const out = { ...values };
  for (const f of fields) {
    const raw = (out[f.key] ?? '').trim();
    if (raw.length === 0 && f.defaultValue !== undefined) {
      out[f.key] = String(f.defaultValue);
    }
  }
  return out;
}

export function validateConnectionFields(
  fields: ConnectionFormFieldDef[],
  values: Record<string, string>,
  messages: { required: string },
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const f of fields) {
    const raw = (values[f.key] ?? '').trim();
    if (f.required && raw.length === 0 && f.defaultValue === undefined) {
      next[f.key] = messages.required;
      continue;
    }
    if (f.type === 'url' && raw.length > 0 && !isValidHttpOrHttpsUrl(raw)) {
      next[f.key] = 'Geçerli bir adres girin (http:// veya https://).';
      continue;
    }
    if (f.type === 'number' && raw.length > 0 && Number.isNaN(Number(raw))) {
      next[f.key] = 'Geçerli bir sayı girin.';
    }
  }
  return next;
}
