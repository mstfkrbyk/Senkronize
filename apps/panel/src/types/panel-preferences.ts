import type { Theme } from '@/store/theme.store';

export type DateFormatPreference = 'DD/MM/YYYY' | 'MM/DD/YYYY';
export type CurrencyFormatPreference = 'tr-TR' | 'en-US';

export interface PanelPreferences {
  theme: Theme;
  language: 'tr' | 'en';
  timezone: string;
  dateFormat: DateFormatPreference;
  currencyFormat: CurrencyFormatPreference;
  sidebarCollapsedDefault: boolean;
}

export const DEFAULT_PANEL_PREFERENCES: PanelPreferences = {
  theme: 'system',
  language: 'tr',
  timezone: 'Europe/Istanbul',
  dateFormat: 'DD/MM/YYYY',
  currencyFormat: 'tr-TR',
  sidebarCollapsedDefault: false,
};
