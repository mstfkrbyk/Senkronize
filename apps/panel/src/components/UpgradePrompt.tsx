import type { ReactElement, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { OrgPlanTier } from '@/types/auth';

const TIER_ORDER: Record<OrgPlanTier, number> = {
  BASLANGIC: 0,
  GELISIM: 1,
  PRO: 2,
  KURUMSAL: 3,
};

const TIER_LABEL: Record<OrgPlanTier, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

function meetsMinimumPlan(
  current: OrgPlanTier | undefined,
  required: OrgPlanTier,
): boolean {
  if (!current) {
    return false;
  }
  return TIER_ORDER[current] >= TIER_ORDER[required];
}

interface Props {
  feature: string;
  requiredPlan: OrgPlanTier;
  currentPlan: OrgPlanTier | undefined;
  description?: ReactNode;
  className?: string;
}

export function UpgradePrompt({
  feature,
  requiredPlan,
  currentPlan,
  description,
  className,
}: Props): ReactElement | null {
  const navigate = useNavigate();

  if (meetsMinimumPlan(currentPlan, requiredPlan)) {
    return null;
  }

  const target = TIER_LABEL[requiredPlan];

  return (
    <Card
      className={cn(
        'border-dashed border-muted-foreground/40 bg-muted/30 shadow-none',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
        <div className="rounded-md border bg-background p-2 text-muted-foreground">
          <Lock className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold text-primary">{feature}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {description ??
              `Bu özellik ${target} paket ve üzeri için kullanılabilir.`}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pb-2 pt-0">
        <p className="text-xs text-muted-foreground">
          Mevcut paketiniz:{' '}
          <span className="font-medium text-foreground">
            {currentPlan ? TIER_LABEL[currentPlan] : '—'}
          </span>
        </p>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          type="button"
          size="sm"
          className="bg-sky-500 text-white hover:bg-sky-600"
          onClick={() => {
            navigate('/settings/subscription');
          }}
        >
          {`${target}'e yükselt`}
        </Button>
      </CardFooter>
    </Card>
  );
}
