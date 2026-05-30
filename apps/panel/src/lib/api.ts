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

function parseMessageField(data: { message?: unknown }): string | null {
  const msg = data.message;
  if (typeof msg === 'string' && msg.trim().length > 0) {
    return msg;
  }
  if (Array.isArray(msg)) {
    const joined = msg.filter((m) => typeof m === 'string').join(', ');
    return joined.length > 0 ? joined : null;
  }
  return null;
}

/** Blob (responseType) ile dönen API hata gövdelerinden Türkçe mesaj çıkarır. */
export async function parseJsonBlobMessage(blob: Blob): Promise<string | null> {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as { message?: unknown };
    if (parsed && typeof parsed === 'object') {
      return parseMessageField(parsed);
    }
  } catch {
    return null;
  }
  return null;
}

function parseApiErrorMessage(error: AxiosError): string {
  const data = error.response?.data;
  if (data instanceof Blob) {
    return 'Beklenmeyen bir hata oluştu.';
  }
  if (data && typeof data === 'object' && 'message' in data) {
    const parsed = parseMessageField(data as { message?: unknown });
    if (parsed) {
      return parsed;
    }
  }
  return 'Beklenmeyen bir hata oluştu.';
}

export async function getApiErrorMessageAsync(error: unknown): Promise<string> {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    const fromBlob = await parseJsonBlobMessage(error.response.data);
    if (fromBlob) {
      return fromBlob;
    }
  }
  return getApiErrorMessage(error);
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

/** Partner yönetim API'leri bayi JWT ile çalışır; müşteri impersonation token'ı kullanılmaz. */
export function isPartnerManagementPath(url: string): boolean {
  const path = url.includes('://')
    ? (() => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      })()
    : url;
  return path.includes('/partner');
}

function resolveRequestBearerToken(config: InternalAxiosRequestConfig): string | null {
  const accessToken = useAuthStore.getState().token;
  const impToken = useImpersonationStore.getState().impersonationToken;
  const url = config.url ?? '';
  if (isPartnerManagementPath(url)) {
    return accessToken;
  }
  return impToken ?? accessToken;
}

api.interceptors.request.use((config) => {
  const token = resolveRequestBearerToken(config);
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

      const nextToken = resolveRequestBearerToken(originalRequest) ?? data.accessToken;
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return api(originalRequest);
    } catch {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }
  },
);
