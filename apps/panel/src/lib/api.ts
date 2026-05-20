import axios, {
  isAxiosError,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

import { trackApiError } from '@/hooks/useAnalytics';
import { useAuthStore } from '@/store/auth.store';
import { useImpersonationStore } from '@/store/impersonation.store';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function parseApiErrorMessage(error: AxiosError): string {
  const data = error.response?.data;
  if (data && typeof data === 'object' && 'message' in data) {
    const msg = (data as { message: unknown }).message;
    if (typeof msg === 'string') {
      return msg;
    }
    if (Array.isArray(msg)) {
      return msg.filter((m) => typeof m === 'string').join(', ');
    }
  }
  return 'Beklenmeyen bir hata oluştu.';
}

export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    return parseApiErrorMessage(error);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Beklenmeyen bir hata oluştu.';
}

api.interceptors.request.use((config) => {
  const impToken = useImpersonationStore.getState().impersonationToken;
  const token = impToken ?? useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetryableRequestConfig | undefined;

    const status = error.response?.status;
    if (status && status >= 400 && status !== 401) {
      const endpoint = originalRequest?.url ?? 'unknown';
      trackApiError(endpoint, status);
    }

    if (status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    const url = originalRequest.url ?? '';
    if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const { data } = await axios.post<{
        accessToken: string;
        refreshToken: string;
        sessionId?: string;
      }>(`${API_BASE_URL}/auth/refresh`, { refreshToken });

      useAuthStore
        .getState()
        .setTokens(data.accessToken, data.refreshToken, data.sessionId);

      const impToken = useImpersonationStore.getState().impersonationToken;
      const nextToken = impToken ?? data.accessToken;
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return api(originalRequest);
    } catch {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }
  },
);
