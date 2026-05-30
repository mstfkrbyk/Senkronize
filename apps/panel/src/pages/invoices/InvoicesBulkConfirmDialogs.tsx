import type { ReactElement } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { invoicesT } from './translations';

interface Props {
  issueOpen: boolean;
  markPaidOpen: boolean;
  issueCount: number;
  markPaidCount: number;
  pending: boolean;
  onIssueOpenChange: (open: boolean) => void;
  onMarkPaidOpenChange: (open: boolean) => void;
  onConfirmIssue: () => void;
  onConfirmMarkPaid: () => void;
}

export function InvoicesBulkConfirmDialogs({
  issueOpen,
  markPaidOpen,
  issueCount,
  markPaidCount,
  pending,
  onIssueOpenChange,
  onMarkPaidOpenChange,
  onConfirmIssue,
  onConfirmMarkPaid,
}: Props): ReactElement {
  return (
    <>
      <AlertDialog open={issueOpen} onOpenChange={onIssueOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{invoicesT('bulk.confirmIssueTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {invoicesT('bulk.confirmIssueDescription', { count: String(issueCount) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{invoicesT('bulk.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={pending || issueCount === 0} onClick={onConfirmIssue}>
              {invoicesT('bulk.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={markPaidOpen} onOpenChange={onMarkPaidOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{invoicesT('bulk.confirmMarkPaidTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {invoicesT('bulk.confirmMarkPaidDescription', {
                count: String(markPaidCount),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{invoicesT('bulk.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || markPaidCount === 0}
              onClick={onConfirmMarkPaid}
            >
              {invoicesT('bulk.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
