const REMEMBER_EMAIL_KEY = 'senkronize:login:remember-email';

export function readRememberedLoginEmail(): string | null {
  try {
    const raw = localStorage.getItem(REMEMBER_EMAIL_KEY);
    return raw?.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function writeRememberedLoginEmail(email: string): void {
  try {
    localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
  } catch {
    /* localStorage unavailable */
  }
}

export function clearRememberedLoginEmail(): void {
  try {
    localStorage.removeItem(REMEMBER_EMAIL_KEY);
  } catch {
    /* localStorage unavailable */
  }
}
