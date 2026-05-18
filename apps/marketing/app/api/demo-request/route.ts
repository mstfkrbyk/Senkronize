import { NextResponse } from 'next/server';

const RATE_WINDOW_MS = 3600_000;
const RATE_MAX = 5;
const rateBucket = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) {
    const first = xf.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

function allowRate(ip: string): boolean {
  const now = Date.now();
  const row = rateBucket.get(ip);
  if (!row || now > row.resetAt) {
    rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (row.count >= RATE_MAX) {
    return false;
  }
  row.count += 1;
  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface DemoBody {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  marketplaceCount?: string;
  message?: string;
}

export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  if (!allowRate(ip)) {
    return NextResponse.json(
      { message: 'Çok fazla istek. Bir saat sonra tekrar deneyin.' },
      { status: 429 },
    );
  }

  let body: DemoBody;
  try {
    body = (await req.json()) as DemoBody;
  } catch {
    return NextResponse.json({ message: 'Geçersiz istek gövdesi' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const company = typeof body.company === 'string' ? body.company.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const marketplaceCount =
    typeof body.marketplaceCount === 'string' ? body.marketplaceCount.trim() : '';
  const message =
    typeof body.message === 'string' ? body.message.trim() : '';

  if (!name || !email || !company || !phone) {
    return NextResponse.json(
      { message: 'İsim, e-posta, şirket ve telefon zorunludur.' },
      { status: 400 },
    );
  }

  const allowedMp = new Set(['1', '2-5', '5+']);
  if (!allowedMp.has(marketplaceCount)) {
    return NextResponse.json(
      { message: 'Geçersiz pazaryeri seçimi.' },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ??
    'Senkronize <noreply@senkronize.com>';

  if (!apiKey) {
    return NextResponse.json(
      { message: 'E-posta yapılandırması eksik.' },
      { status: 503 },
    );
  }

  const html = `
    <h2>Yeni demo talebi</h2>
    <p><strong>İsim:</strong> ${escapeHtml(name)}</p>
    <p><strong>E-posta:</strong> ${escapeHtml(email)}</p>
    <p><strong>Şirket:</strong> ${escapeHtml(company)}</p>
    <p><strong>Telefon:</strong> ${escapeHtml(phone)}</p>
    <p><strong>Pazaryeri sayısı:</strong> ${escapeHtml(marketplaceCount)}</p>
    <p><strong>Mesaj:</strong><br/>${escapeHtml(message || '—')}</p>
    <p style="color:#666;font-size:12px">IP: ${escapeHtml(ip)}</p>
  `;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: ['support@senkronize.com'],
      subject: `[Demo] ${name} — ${company}`,
      html,
    }),
  });

  if (!resendRes.ok) {
    return NextResponse.json(
      { message: 'E-posta gönderilemedi.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
