import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Menu,
  Package,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';

import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface NavItemProps {
  href?: string;
  icon: typeof LayoutDashboard;
  label: string;
  onClick?: () => void;
}

function NavItem({ href, icon: Icon, label, onClick }: NavItemProps): ReactElement {
  const sharedClass =
    'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors';

  if (href) {
    return (
      <NavLink
        to={href}
        end={href === '/dashboard'}
        className={({ isActive }) =>
          cn(
            sharedClass,
            'hover:text-foreground',
            isActive && 'text-primary',
          )
        }
      >
        <Icon className="h-5 w-5" aria-hidden />
        <span>{label}</span>
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      className={cn(sharedClass, 'hover:text-foreground')}
      onClick={onClick}
      aria-label={label}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span>{label}</span>
    </button>
  );
}

export function MobileBottomNav(): ReactElement {
  const { setOpenMobile } = useSidebar();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden supports-[padding:max(0px)]:pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobil navigasyon"
    >
      <div className="grid h-16 grid-cols-5">
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Ana Sayfa" />
        <NavItem href="/orders" icon={ShoppingCart} label="Siparişler" />
        <NavItem href="/products" icon={Package} label="Ürünler" />
        <NavItem href="/stock" icon={Warehouse} label="Stok" />
        <NavItem
          icon={Menu}
          label="Menü"
          onClick={() => {
            setOpenMobile(true);
          }}
        />
      </div>
    </nav>
  );
}
