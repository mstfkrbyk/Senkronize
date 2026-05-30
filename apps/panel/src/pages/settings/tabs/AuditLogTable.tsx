import type { ReactElement } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  auditLogUserLabel,
  formatAuditLogAction,
  formatAuditLogResourceDisplay,
} from '@/lib/audit-log-labels';
import type { AuditLogEntry } from '@/types/audit-log';

interface Props {
  entries: AuditLogEntry[];
}

export function AuditLogTable({ entries }: Props): ReactElement {
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Henüz denetim kaydı yok.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>İşlem</TableHead>
            <TableHead>Kaynak</TableHead>
            <TableHead>Kullanıcı</TableHead>
            <TableHead className="text-right">Tarih</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {formatAuditLogAction(row.action)}
              </TableCell>
              <TableCell
                className="text-muted-foreground"
                title={
                  row.resourceId
                    ? `${row.resource} · ${row.resourceId}`
                    : row.resource
                }
              >
                {formatAuditLogResourceDisplay(row.resource, row.resourceId)}
              </TableCell>
              <TableCell className="max-w-[140px] truncate text-sm">
                {auditLogUserLabel(row)}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(row.createdAt), {
                  addSuffix: true,
                  locale: tr,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
