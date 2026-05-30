import type { ReactElement } from 'react';
import { Paperclip } from 'lucide-react';

import { getSupportContactEmail } from '@/lib/support-contact';
import { cn } from '@/lib/utils';

interface Props {
  /** Modal: çerçeveli kutu; detay: mesaj formu altı satır */
  variant?: 'boxed' | 'inline';
  className?: string;
}

export function TicketFileAttachmentHint({
  variant = 'inline',
  className,
}: Props): ReactElement {
  const supportEmail = getSupportContactEmail();

  const body = (
    <div className={variant === 'boxed' ? 'space-y-1' : undefined}>
      <p>
        Henüz panelden dosya ekleyemezsiniz. Görsel veya belge paylaşmak için açıklama
        alanına metin ya da bağlantı yazabilirsiniz.
      </p>
      {supportEmail ? (
        <p>
          Dosya göndermek için{' '}
          <a
            href={`mailto:${supportEmail}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {supportEmail}
          </a>{' '}
          adresine e-posta atabilirsiniz.
        </p>
      ) : null}
    </div>
  );

  if (variant === 'boxed') {
    return (
      <div
        className={cn(
          'flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-4 text-sm text-muted-foreground',
          className,
        )}
      >
        <Paperclip className="mt-0.5 size-4 shrink-0" aria-hidden />
        {body}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2 text-sm text-muted-foreground',
        className,
      )}
    >
      <Paperclip className="mt-0.5 size-4 shrink-0" aria-hidden />
      {body}
    </div>
  );
}
