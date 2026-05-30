import { useEffect, useState, type ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import type { NavItem } from '@/constants/navigation';
import { prefetchRoute } from '@/lib/routePreload';
import { cn } from '@/lib/utils';
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';

interface CollapsibleNavGroupProps {
  item: NavItem;
  isActive: boolean;
  isChildActive: (child: NavItem) => boolean;
  navItemTo: (navItem: NavItem) => string | { pathname: string; search?: string };
  t: (key: string) => string;
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
}

export function CollapsibleNavGroup({
  item,
  isActive,
  isChildActive,
  navItemTo,
  t,
  isMobile,
  setOpenMobile,
}: CollapsibleNavGroupProps): ReactElement {
  const [open, setOpen] = useState(isActive);
  const Icon = item.icon;
  const children = item.children ?? [];

  useEffect(() => {
    if (isActive) {
      setOpen(true);
    }
  }, [isActive]);

  const closeMobile = (): void => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={isActive}
        tooltip={t(item.labelKey)}
        data-state={open ? 'open' : 'closed'}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{t(item.labelKey)}</span>
        <ChevronRight
          className={cn(
            'ml-auto size-4 shrink-0 transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
      </SidebarMenuButton>
      {open ? (
        <SidebarMenuSub>
          {children.map((child) => {
            const ChildIcon = child.icon;
            const childActive = isChildActive(child);

            return (
              <SidebarMenuSubItem key={`${child.path}${child.search ?? ''}`}>
                <SidebarMenuSubButton asChild isActive={childActive} size="sm">
                  <NavLink
                    to={navItemTo(child)}
                    onMouseEnter={() => {
                      prefetchRoute(child.path);
                    }}
                    onFocus={() => {
                      prefetchRoute(child.path);
                    }}
                    onClick={closeMobile}
                  >
                    <ChildIcon className="size-4 shrink-0" />
                    <span>{child.label ?? t(child.labelKey)}</span>
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}
