import type { ReactElement, ReactNode } from 'react';
import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Calculator, Plug, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import {
  hasOrgProductLine,
  resolveProductLineDenyPath,
  resolveStockRouteProductLine,
} from '@/lib/org-products';
import {
  shouldPlaceStockInEcommerce,
  shouldPlaceStockInNativeAccounting,
} from '@/lib/nav-match';
import {
  productLineRouteMessageKeys,
  resolveProductLineRedirectToastKey,
} from '@/lib/product-line-route-messages';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { OrgProductLine } from '@/types/auth';

interface ProductLineAccessPromptProps {
  required: OrgProductLine;
}

function ProductLineAccessPrompt({
  required,
}: ProductLineAccessPromptProps): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const keys = productLineRouteMessageKeys(required);
  const Icon = required === 'INTEGRATION' ? Plug : Calculator;
  const isIntegration = required === 'INTEGRATION';

  return (
    <Card
      className={cn(
        'bg-gradient-to-br via-background to-slate-50',
        isIntegration
          ? 'border-amber-200/80 from-amber-50/60'
          : 'border-sky-200/80 from-sky-50/60',
      )}
    >
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border',
            isIntegration
              ? 'border-amber-200 bg-amber-500/10 text-amber-700'
              : 'border-sky-200 bg-sky-500/10 text-sky-600',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles
              className={cn(
                'h-4 w-4',
                isIntegration ? 'text-amber-600' : 'text-sky-500',
              )}
              aria-hidden
            />
            <CardTitle className="text-base font-semibold text-primary">
              {t(keys.feature)}
            </CardTitle>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(keys.description)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pb-2 pt-0" />
      <CardFooter className="gap-2 pt-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            isIntegration && 'border-amber-300 hover:bg-amber-50',
          )}
          onClick={() => {
            navigate('/settings/subscription');
          }}
        >
          {t(keys.cta)}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProductLineDenyRedirect({
  required,
}: {
  required: OrgProductLine;
}): ReactElement {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const redirectToastKey = resolveProductLineRedirectToastKey(required, {
    pathname,
    orgProducts,
    accountingMode,
  });

  useEffect(() => {
    toast.info(t(redirectToastKey));
  }, [t, redirectToastKey]);

  return (
    <Navigate
      to={resolveProductLineDenyPath(required, {
        pathname,
        orgProducts,
        accountingMode,
      })}
      replace
    />
  );
}

interface ProductLineRouteProps {
  required: OrgProductLine;
  children: ReactNode;
  /** Erişim yoksa tam sayfa kartı (varsayılan) veya ana sayfaya yönlendirme */
  fallback?: 'prompt' | 'redirect';
}

export function ProductLineRoute({
  required,
  children,
  fallback = 'prompt',
}: ProductLineRouteProps): ReactElement {
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);

  if (hasOrgProductLine(orgProducts, required)) {
    return <>{children}</>;
  }

  if (fallback === 'redirect') {
    return <ProductLineDenyRedirect required={required} />;
  }

  return (
    <div className="space-y-6">
      <ProductLineAccessPrompt required={required} />
    </div>
  );
}

interface ProductLineRouteOptions {
  fallback?: ProductLineRouteProps['fallback'];
}

/** App.tsx rota tanımlarında kısa sarmalayıcı */
export function integrationRoute(
  page: ReactElement,
  options?: ProductLineRouteOptions,
): ReactElement {
  return (
    <ProductLineRoute required="INTEGRATION" fallback={options?.fallback}>
      {page}
    </ProductLineRoute>
  );
}

export function accountingRoute(
  page: ReactElement,
  options?: ProductLineRouteOptions,
): ReactElement {
  return (
    <ProductLineRoute required="ACCOUNTING" fallback={options?.fallback}>
      {page}
    </ProductLineRoute>
  );
}

function StockProductLineRoute({
  children,
  fallback = 'prompt',
}: Omit<ProductLineRouteProps, 'required'>): ReactElement {
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const required = resolveStockRouteProductLine(orgProducts, accountingMode);

  return (
    <ProductLineRoute required={required} fallback={fallback}>
      {children}
    </ProductLineRoute>
  );
}

/** Stok rotaları — muhasebe modu ve ürün hattına göre ACCOUNTING veya INTEGRATION */
export function stockRoute(
  page: ReactElement,
  options?: ProductLineRouteOptions,
): ReactElement {
  return (
    <StockProductLineRoute fallback={options?.fallback}>
      {page}
    </StockProductLineRoute>
  );
}

function ProductsHubAccess({
  children,
  fallback = 'prompt',
}: Omit<ProductLineRouteProps, 'required'>): ReactElement {
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const ctx = { orgProducts, accountingMode };
  const hasIntegration = hasOrgProductLine(orgProducts, 'INTEGRATION');
  const showStock =
    shouldPlaceStockInEcommerce(ctx) || shouldPlaceStockInNativeAccounting(ctx);

  if (hasIntegration || showStock) {
    return <>{children}</>;
  }

  return (
    <ProductLineRoute required="INTEGRATION" fallback={fallback}>
      {children}
    </ProductLineRoute>
  );
}

/** Ürünler hub — katalog (INTEGRATION) ve/veya stok sekmeleri */
export function productsHubRoute(
  page: ReactElement,
  options?: ProductLineRouteOptions,
): ReactElement {
  return (
    <ProductsHubAccess fallback={options?.fallback}>{page}</ProductsHubAccess>
  );
}
