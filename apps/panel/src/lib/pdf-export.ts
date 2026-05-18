function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function printReport(elementId: string, title: string): void {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return;
  }

  const safeTitle = escapeHtml(title);
  const generatedAt = escapeHtml(new Date().toLocaleString('tr-TR'));

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <title>${safeTitle} — Senkronize</title>
      <meta charset="utf-8">
      <style>
        body { font-family: system-ui, sans-serif; padding: 20px; color: #111; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 20px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${safeTitle}</h1>
      <p class="subtitle">Oluşturma tarihi: ${generatedAt}</p>
      ${element.innerHTML}
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}
