import type { ReactElement, ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
  /** İçeriği kısıtlamak için max-width. Varsayılan: max-w-2xl */
  maxWidth?: 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl';
  /** Başlık yanındaki buton/eylem alanı */
  actions?: ReactNode;
}

export function SettingsPageShell({
  title,
  description,
  children,
  maxWidth = 'max-w-2xl',
  actions,
}: Props): ReactElement {
  return (
    <div className={`mx-auto w-full ${maxWidth} space-y-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
