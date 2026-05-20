import type { ReactElement, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
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
  currentPlan?: OrgPlanTier;
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
  const orgPlan = useAuthStore((s) => s.currentOrg?.plan);
  const effectivePlan = currentPlan ?? orgPlan;

  if (meetsMinimumPlan(effectivePlan, requiredPlan)) {
    return null;
  }

  const target = TIER_LABEL[requiredPlan];

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-sky-200 bg-gradient-to-br from-sky-50/90 via-background to-slate-50 shadow-sm',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky-400/10 blur-2xl"
        aria-hidden
      />
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-500/10 text-sky-600">
          <Lock className="h-5 w-5 animate-lock-wiggle" aria-hidden />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-500" aria-hidden />
            <CardTitle className="text-base font-semibold text-primary">{feature}</CardTitle>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description ??
              `Bu özellik ${target} paket ve üzeri için kullanılabilir.`}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pb-2 pt-0">
        <p className="text-xs text-muted-foreground">
          Mevcut paketiniz:{' '}
          <span className="font-medium text-foreground">
            {effectivePlan ? TIER_LABEL[effectivePlan] : '—'}
          </span>
        </p>
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Button
          type="button"
          size="sm"
          className="bg-sky-500 text-white shadow-sm hover:bg-sky-600"
          onClick={() => {
            navigate('/settings/subscription');
          }}
        >
          {`${target}'a Geç`}
        </Button>
      </CardFooter>
    </Card>
  );
}
