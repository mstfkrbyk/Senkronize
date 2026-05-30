/** Üst bağlam satırı: menü grubu + sayfa (ör. «Ön Muhasebe > Müşteriler»). */
export function formatNavPageContext(
  groupLabel: string | undefined,
  pageLabel: string,
  leafLabel?: string,
): string {
  const pageSegment =
    leafLabel != null && leafLabel.length > 0
      ? `${pageLabel} > ${leafLabel}`
      : pageLabel;
  if (groupLabel != null && groupLabel.length > 0) {
    return `${groupLabel} > ${pageSegment}`;
  }
  return pageSegment;
}
