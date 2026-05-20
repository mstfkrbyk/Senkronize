import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import {
  DEFAULT_PANEL_PREFERENCES,
  type PanelPreferences,
} from '@/types/panel-preferences';

function parsePanelPreferences(raw: Record<string, unknown>): PanelPreferences {
  return {
    theme:
      raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system'
        ? raw.theme
        : DEFAULT_PANEL_PREFERENCES.theme,
    language: raw.language === 'en' ? 'en' : 'tr',
    timezone:
      typeof raw.timezone === 'string' && raw.timezone.length > 0
        ? raw.timezone
        : DEFAULT_PANEL_PREFERENCES.timezone,
    dateFormat:
      raw.dateFormat === 'MM/DD/YYYY' ? 'MM/DD/YYYY' : 'DD/MM/YYYY',
    currencyFormat:
      raw.currencyFormat === 'en-US' ? 'en-US' : 'tr-TR',
    sidebarCollapsedDefault: raw.sidebarCollapsedDefault === true,
  };
}

export function usePanelPreferences() {
  return useQuery({
    queryKey: ['panel-preferences'],
    queryFn: async (): Promise<PanelPreferences> => {
      const { data } = await api.get<Record<string, unknown>>('/users/panel-preferences');
      return parsePanelPreferences(data);
    },
  });
}

export function useUpdatePanelPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<PanelPreferences>): Promise<PanelPreferences> => {
      const { data } = await api.patch<Record<string, unknown>>(
        '/users/panel-preferences',
        payload,
      );
      return parsePanelPreferences(data);
    },
    onSuccess: (data) => {
      void queryClient.setQueryData(['panel-preferences'], data);
      toast.success('Görünüm ayarları kaydedildi.');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}
