import type { ReactElement } from 'react';
import { Check, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  strengthBarColor,
  strengthLabel,
  validatePassword,
  type PasswordStrength,
} from '@/lib/password-policy';

interface Props {
  password: string;
  className?: string;
}

function barWidth(score: number): string {
  return `${Math.min(100, Math.max(0, score))}%`;
}

export function PasswordStrengthMeter({
  password,
  className,
}: Props): ReactElement | null {
  if (password.length === 0) {
    return null;
  }

  const result = validatePassword(password);
  const strength: PasswordStrength = result.strength;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Şifre gücü</span>
          <span className="font-medium text-foreground">
            {strengthLabel(strength)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              strengthBarColor(strength),
            )}
            style={{ width: barWidth(result.score) }}
            role="progressbar"
            aria-valuenow={result.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Şifre gücü: ${strengthLabel(strength)}`}
          />
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {result.rules.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-2',
              rule.passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground',
            )}
          >
            {rule.passed ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <X className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
