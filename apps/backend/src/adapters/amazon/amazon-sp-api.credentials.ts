export function amazonResolveLwaCredentials(credentials: Record<string, string>): {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
} {
  const clientId =
    credentials.clientId?.trim() ||
    credentials.lwaClientId?.trim() ||
    '';
  const clientSecret =
    credentials.clientSecret?.trim() ||
    credentials.lwaClientSecret?.trim() ||
    '';
  const refreshToken = credentials.refreshToken?.trim() ?? '';
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Amazon: clientId, clientSecret ve refreshToken (LWA) zorunludur',
    );
  }
  return { clientId, clientSecret, refreshToken };
}

export function amazonResolveAwsCredentials(credentials: Record<string, string>): {
  accessKeyId: string;
  secretAccessKey: string;
} {
  const accessKeyId = credentials.accessKeyId?.trim() ?? '';
  const secretAccessKey = credentials.secretAccessKey?.trim() ?? '';
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Amazon: accessKeyId ve secretAccessKey (IAM) zorunludur');
  }
  return { accessKeyId, secretAccessKey };
}

export function amazonResolveMarketplaceId(
  credentials: Record<string, string>,
  fallback: string,
): string {
  const raw = credentials.marketplaceId?.trim();
  return raw && raw.length > 0 ? raw : fallback;
}
