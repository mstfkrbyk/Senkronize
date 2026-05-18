/** `request.user` when authenticated via API key (Bearer sk_live_* veya X-Api-Key) */
export interface ApiKeyAuthUser {
  currentOrgId: string;
  isImpersonating: false;
  apiKeyId: string;
}
