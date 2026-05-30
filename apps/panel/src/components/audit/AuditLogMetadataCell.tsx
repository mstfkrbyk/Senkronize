import type { ReactElement } from 'react';

import {
  buildAuditLogMetadataSummary,
  formatAuditLogMetadataOneLiner,
} from '@/lib/audit-log-labels';

interface Props {
  metadata?: Record<string, unknown> | null;
  action?: string;
  className?: string;
}

function normalizeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return metadata;
}

function safeJsonStringify(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return '{}';
  }
}

export function AuditLogMetadataCell({
  metadata,
  action,
  className,
}: Props): ReactElement {
  const meta = normalizeMetadata(metadata);
  const summary = buildAuditLogMetadataSummary(meta, action);
  const oneLiner = formatAuditLogMetadataOneLiner(meta, action);
  const hasMeta = Object.keys(meta).length > 0;

  if (!hasMeta) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (summary.length === 0) {
    return (
      <details className={className}>
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          Teknik detay
        </summary>
        <pre className="mt-2 max-w-[280px] overflow-x-auto whitespace-pre-wrap break-all rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
          {safeJsonStringify(meta)}
        </pre>
      </details>
    );
  }

  return (
    <div className={className}>
      {summary.length <= 2 ? (
        <p className="text-sm text-foreground">{oneLiner}</p>
      ) : (
        <ul className="space-y-0.5 text-sm text-foreground">
          {summary.map((line) => (
            <li key={line.label}>
              <span className="text-muted-foreground">{line.label}: </span>
              {line.value}
            </li>
          ))}
        </ul>
      )}
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Ham veri
        </summary>
        <pre className="mt-1 max-w-[280px] overflow-x-auto whitespace-pre-wrap break-all rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
          {safeJsonStringify(meta)}
        </pre>
      </details>
    </div>
  );
}
