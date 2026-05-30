import type { ReactElement } from 'react';
import { Info } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  note: string | null;
}

export function PartnerCommissionNoteAlert({ note }: Props): ReactElement | null {
  if (note == null) {
    return null;
  }

  return (
    <Alert className="border-sky-200 bg-sky-50/80 text-sky-950">
      <Info className="h-4 w-4 text-sky-600" aria-hidden />
      <AlertDescription className="text-sky-900/90">{note}</AlertDescription>
    </Alert>
  );
}
