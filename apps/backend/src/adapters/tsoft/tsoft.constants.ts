export const TSOFT_API_VERSION = 'v3';
export const tsoftApiBase = (storeUrl: string) =>
  `${storeUrl.replace(/\/+$/, '').trim()}/api/${TSOFT_API_VERSION}`;
export const TSOFT_TOKEN_PATH = '/oauth/token';
