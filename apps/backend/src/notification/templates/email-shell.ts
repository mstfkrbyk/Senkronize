const BRAND = '#4F46E5';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wrapEmail(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Senkronize</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:${BRAND};padding:20px 24px;">
              <span style="color:#ffffff;font-size:18px;font-weight:600;">Senkronize</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;color:#334155;font-size:15px;line-height:1.65;">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;">
              Bu e-posta Senkronize tarafından gönderilmiştir.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function safeHref(raw: unknown): string {
  if (typeof raw !== 'string' || !/^https?:\/\//i.test(raw)) {
    return '#';
  }
  return raw;
}
