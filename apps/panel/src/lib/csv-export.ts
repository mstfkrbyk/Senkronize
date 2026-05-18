function escapeCsvCell(value: unknown): string {
  if (value == null) {
    return '""';
  }
  if (typeof value === 'object') {
    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  }
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function exportToCsv(data: Record<string, unknown>[], filename: string): void {
  if (!data.length) {
    return;
  }
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => escapeCsvCell(row[h])).join(','),
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
