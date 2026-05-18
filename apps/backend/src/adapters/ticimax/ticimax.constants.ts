export const ticimaxApiBase = (apiUrl: string) =>
  `${apiUrl.replace(/\/$/, '').trim()}/api`;
