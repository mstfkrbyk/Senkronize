import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plug, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PRODUCT_LINE_ROUTE_CTA_KEY } from '@/lib/product-line-route-messages';

interface Props {
  showNativeAccountingCta?: boolean;
}

export function IntegrationProductPrompt({
  showNativeAccountingCta = false,
}: Props): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/60 via-background to-slate-50">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-500/10 text-amber-700">
          <Plug className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
            <CardTitle className="text-base font-semibold text-primary">
              {t('connections.integrationUpgrade.feature')}
            </CardTitle>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('connections.integrationUpgrade.description')}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pb-2 pt-0" />
      <CardFooter className="flex flex-wrap gap-2 pt-0">
        {showNativeAccountingCta ? (
          <Button type="button" size="sm" variant="default" asChild>
            <Link to="/accounting">
              <FileText className="mr-2 h-4 w-4" aria-hidden />
              {t('connections.integrationUpgrade.goToAccounting')}
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-amber-300 hover:bg-amber-50"
          onClick={() => {
            navigate('/settings/subscription');
          }}
        >
          {t(PRODUCT_LINE_ROUTE_CTA_KEY)}
        </Button>
      </CardFooter>
    </Card>
  );
}
