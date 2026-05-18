/** `request.user` when authenticated via X-Api-Key */
export interface ApiKeyAuthUser {
  currentOrgId: string;
  isImpersonating: false;
  apiKeyId: string;
}
