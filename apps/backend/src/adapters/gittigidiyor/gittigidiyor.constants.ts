export const GITTIGIDIYOR_DEVAPI_BASE =
  'https://dev.gittigidiyor.com/devapi/rest';

export const GITTIGIDIYOR_OAUTH_BASE =
  'https://dev.gittigidiyor.com/devapi/rest/auth/oauth';

export const GITTIGIDIYOR_CURRENCY_TRY = 1;

/** Sipariş durumları — seller rolü */
export const GITTIGIDIYOR_ORDER_STATUSES = [
  'WaitingforShipment',
  'Shipped',
  'Completed',
] as const;

export type GittigidiyorOrderStatus =
  (typeof GITTIGIDIYOR_ORDER_STATUSES)[number];
