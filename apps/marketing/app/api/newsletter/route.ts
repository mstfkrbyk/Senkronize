import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isLikelyDuplicateContactError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('already') ||
    m.includes('exist') ||
    m.includes('duplicate') ||
    m.includes('zaten') ||
    m.includes('unique')
  );
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const segmentId = process.env.RESEND_NEWSLETTER_SEGMENT_ID?.trim();
  const audienceId = process.env.RESEND_NEWSLETTER_AUDIENCE_ID?.trim();

  if (!apiKey || (!segmentId && !audienceId)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          'Bülten kaydı şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Geçersiz istek gövdesi.' },
      { status: 400 },
    );
  }

  const emailRaw =
    typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof (body as { email: unknown }).email === 'string'
      ? (body as { email: string }).email
      : '';

  const email = normalizeEmail(emailRaw);
  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { ok: false, message: 'Geçerli bir e-posta adresi girin.' },
      { status: 400 },
    );
  }

  const resend = new Resend(apiKey);

  const result = segmentId
    ? await resend.contacts.create({
        email,
        segments: [{ id: segmentId }],
        unsubscribed: false,
      })
    : await resend.contacts.create({
        email,
        audienceId: audienceId!,
        unsubscribed: false,
      });

  if (result.error) {
    if (isLikelyDuplicateContactError(result.error.message)) {
      return NextResponse.json({
        ok: true,
        message: 'Bu e-posta adresi zaten bülten listemizde kayıtlı.',
      });
    }
    return NextResponse.json(
      { ok: false, message: 'Kayıt sırasında bir sorun oluştu.' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Teşekkürler! Kaydınız alındı.',
  });
}
