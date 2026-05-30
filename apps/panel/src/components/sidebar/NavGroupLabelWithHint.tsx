import type { ReactElement } from 'react';
import { Info } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SidebarGroupLabel } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  hint: string;
  className?: string;
}

export function NavGroupLabelWithHint({
  label,
  hint,
  className,
}: Props): ReactElement {
  return (
    <SidebarGroupLabel
      className={cn(
        'text-xs uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 rounded-sm text-muted-foreground/70 outline-none hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-sidebar-ring"
              aria-label={hint}
            >
              <Info className="size-3" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="max-w-[280px] text-pretty text-xs leading-relaxed font-normal normal-case"
          >
            {hint}
          </TooltipContent>
        </Tooltip>
      </span>
    </SidebarGroupLabel>
  );
}
