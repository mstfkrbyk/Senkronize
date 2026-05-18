import { AsyncLocalStorage } from 'node:async_hooks';

export type AuditHttpContext =
  | {
      kind: 'user';
      actorUserId: string;
      actorOrgId: string;
      impersonatedOrgId: string | null;
    }
  | {
      kind: 'apiKey';
      apiKeyId: string;
      actorOrgId: string;
    };

export const auditHttpContext = new AsyncLocalStorage<AuditHttpContext>();

export function getAuditHttpContext(): AuditHttpContext | undefined {
  return auditHttpContext.getStore();
}
