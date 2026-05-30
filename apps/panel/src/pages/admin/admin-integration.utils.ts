import type { AdminIntegrationDetail, AdminIntegrationListItem } from '@/types/admin';

export type IntegrationFormValues = Record<string, string | boolean | null>;

export function detailToFormValues(detail: AdminIntegrationDetail): IntegrationFormValues {
  const form: IntegrationFormValues = {};
  for (const field of detail.fields) {
    const raw = detail.values[field.key as keyof typeof detail.values];
    if (field.type === 'boolean') {
      form[field.key] = detail.values.enabled;
      continue;
    }
    form[field.key] = raw == null ? '' : String(raw);
  }
  if (!detail.fields.some((f) => f.key === 'enabled')) {
    form.enabled = detail.values.enabled;
  }
  return form;
}

export function formToUpdatePayload(
  detail: AdminIntegrationDetail,
  form: IntegrationFormValues,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of detail.fields) {
    const raw = form[field.key];
    if (field.type === 'boolean') {
      payload.enabled = raw === true;
      continue;
    }
    if (raw === '' || raw == null) {
      payload[field.key] = null;
      continue;
    }
    if (field.type === 'syncFrequency') {
      payload[field.key] = String(raw);
      continue;
    }
    payload[field.key] = Number(raw);
  }
  return payload;
}

export function filterIntegrations(
  items: AdminIntegrationListItem[],
  query: string,
  category: string,
): AdminIntegrationListItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category !== 'ALL' && item.category !== category) {
      return false;
    }
    if (!q) {
      return true;
    }
    return (
      item.platformKey.toLowerCase().includes(q) ||
      item.displayName.toLowerCase().includes(q)
    );
  });
}
