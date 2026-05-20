export const TIMEZONE_STORAGE_KEY = 'senkronize-timezone';

export const DEFAULT_TIMEZONE = 'Europe/Istanbul';

export const TIMEZONES = [
  { value: 'Europe/Istanbul', labelKey: 'settings.timezones.istanbul' },
  { value: 'Europe/London', labelKey: 'settings.timezones.london' },
  { value: 'America/New_York', labelKey: 'settings.timezones.newYork' },
  { value: 'America/Los_Angeles', labelKey: 'settings.timezones.losAngeles' },
  { value: 'Asia/Dubai', labelKey: 'settings.timezones.dubai' },
] as const;

const VALID_TIMEZONES = new Set<string>(TIMEZONES.map((tz) => tz.value));

export function getStoredTimezone(): string {
  try {
    const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (stored && VALID_TIMEZONES.has(stored)) {
      return stored;
    }
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_TIMEZONE;
}

export function setStoredTimezone(timezone: string): void {
  try {
    localStorage.setItem(TIMEZONE_STORAGE_KEY, timezone);
  } catch {
    /* localStorage unavailable */
  }
}

export function formatDateWithTimezone(
  iso: string,
  locale: string,
  timezone: string = getStoredTimezone(),
): string {
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'tr-TR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
