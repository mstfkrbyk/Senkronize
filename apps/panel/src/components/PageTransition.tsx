import type { ReactElement, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

export function PageTransition({ children }: Props): ReactElement {
  const { pathname } = useLocation();
  return (
    <div
      key={pathname}
      className="w-full animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {children}
    </div>
  );
}
