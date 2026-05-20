export const TSOFT_API_BASE = 'https://api.tsoft.com.tr/api/v1';

export function resolveTsoftApiKey(credentials: Record<string, string>): string {
  return (
    credentials.apiKey?.trim() ??
    credentials.tSoftApiKey?.trim() ??
    credentials.clientId?.trim() ??
    ''
  );
}
