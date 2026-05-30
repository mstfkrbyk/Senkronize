/** İsteğe bağlı destek e-postası (VITE_SUPPORT_EMAIL). Geçersiz veya boşsa null. */
export function getSupportContactEmail(): string | null {
  const raw = import.meta.env.VITE_SUPPORT_EMAIL?.trim();
  if (!raw || !raw.includes('@')) {
    return null;
  }
  return raw;
}
