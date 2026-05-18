import { NextResponse } from 'next/server';

const RATE_WINDOW_MS = 3600_000;
const RATE_MAX = 8;
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

interface ContactBody {
  name?: string;
  email?: string;
  subject?: string;
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

  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json({ message: 'Geçersiz istek gövdesi' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { message: 'Ad, e-posta, konu ve mesaj zorunludur.' },
      { status: 400 },
    );
  }

  if (name.length > 120 || subject.length > 200 || message.length > 8000) {
    return NextResponse.json({ message: 'Alan uzunlukları aşıldı.' }, { status: 400 });
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
    <h2>İletişim formu</h2>
    <p><strong>Ad:</strong> ${escapeHtml(name)}</p>
    <p><strong>E-posta:</strong> ${escapeHtml(email)}</p>
    <p><strong>Konu:</strong> ${escapeHtml(subject)}</p>
    <p><strong>Mesaj:</strong><br/>${escapeHtml(message)}</p>
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
      to: ['hello@senkronize.com'],
      reply_to: email,
      subject: `[İletişim] ${subject}`,
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
