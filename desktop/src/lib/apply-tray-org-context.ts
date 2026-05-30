import { formatOrgContextLine } from '@/lib/org-context-labels';
import { tauriApi } from '@/lib/tauri';

export async function applyTrayOrgContext(args: {
  productLines?: readonly string[];
  accountingMode?: string | null;
}): Promise<void> {
  const line = formatOrgContextLine(args);
  await tauriApi.setTrayOrgContext(line ?? '');
}
