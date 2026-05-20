export interface SessionMetaInput {
  ipAddress?: string;
  userAgent?: string;
}

export function parseDeviceInfo(userAgent: string | null | undefined): string | null {
  if (!userAgent?.trim()) {
    return null;
  }
  const ua = userAgent;

  let os = 'Bilinmeyen işletim sistemi';
  if (/Windows NT/i.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    os = 'macOS';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Bilinmeyen tarayıcı';
  if (/Edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
    browser = 'Chrome';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Firefox';
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = 'Safari';
  } else if (/Opera|OPR\//i.test(ua)) {
    browser = 'Opera';
  }

  if (/Mobile|Android|iPhone/i.test(ua)) {
    return `${browser} · ${os} (Mobil)`;
  }
  return `${browser} · ${os}`;
}
