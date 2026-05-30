import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAccountingMode } from '@/hooks/useAccountingMode';
import {
  resolveListingPushNoteKey,
  resolveListingPushNoteLink,
  type ListingPushNoteKind,
} from '@/lib/listing-push-notes';
import { useAuthStore } from '@/store/auth.store';

interface Props {
  kind: ListingPushNoteKind;
  className?: string;
}

/** Fiyat/stok push — muhasebe moduna göre kısa bilgi notu */
export function ListingDetailPushHint({ kind, className }: Props): ReactElement | null {
  const { t } = useTranslation();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode, isLoading } = useAccountingMode();

  if (isLoading) {
    return null;
  }

  const ctx = { accountingMode: mode, orgProducts };
  const link = resolveListingPushNoteLink(kind, ctx);

  return (
    <p className={className ?? 'text-xs leading-relaxed text-muted-foreground'}>
      {t(resolveListingPushNoteKey(kind, ctx))}
      {link ? (
        <>
          {' '}
          <Link
            to={link.to}
            className="font-medium text-foreground/80 underline-offset-2 hover:underline"
          >
            {t(link.labelKey)}
          </Link>
        </>
      ) : null}
    </p>
  );
}
