import type { ReactElement } from 'react';

import { Banknote, FileCheck, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { invoicesT } from './translations';

interface Props {
  selectedCount: number;
  issueEligibleCount: number;
  markPaidEligibleCount: number;
  issuePending: boolean;
  markPaidPending: boolean;
  onIssue: () => void;
  onMarkPaid: () => void;
  onClearSelection: () => void;
}

export function InvoicesBulkToolbar({
  selectedCount,
  issueEligibleCount,
  markPaidEligibleCount,
  issuePending,
  markPaidPending,
  onIssue,
  onMarkPaid,
  onClearSelection,
}: Props): ReactElement | null {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2">
      <span className="text-sm font-medium">
        {invoicesT('bulk.selected', { count: String(selectedCount) })}
      </span>
      <Button
        type="button"
        size="sm"
        variant="default"
        disabled={issueEligibleCount === 0 || issuePending || markPaidPending}
        title={
          issueEligibleCount === 0 ? invoicesT('bulk.noDraftSelected') : undefined
        }
        onClick={onIssue}
      >
        {issuePending ? (
          <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
        ) : (
          <FileCheck className="mr-1 size-3.5" aria-hidden />
        )}
        {invoicesT('actions.issue')}
        {issueEligibleCount > 0 ? ` (${String(issueEligibleCount)})` : ''}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={markPaidEligibleCount === 0 || issuePending || markPaidPending}
        title={
          markPaidEligibleCount === 0 ? invoicesT('bulk.noPayableSelected') : undefined
        }
        onClick={onMarkPaid}
      >
        {markPaidPending ? (
          <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
        ) : (
          <Banknote className="mr-1 size-3.5" aria-hidden />
        )}
        {invoicesT('actions.markPaid')}
        {markPaidEligibleCount > 0 ? ` (${String(markPaidEligibleCount)})` : ''}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onClearSelection}>
        {invoicesT('bulk.clearSelection')}
      </Button>
    </div>
  );
}
