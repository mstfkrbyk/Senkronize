import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import { KpiWidget } from '@/components/widgets/KpiWidget';
import { useCountUp } from '@/hooks/useCountUp';

export interface AnimatedKpiCardProps {
  title: string;
  numericValue: number;
  format: 'currency' | 'integer' | 'percent';
  change: number;
  changeCaption?: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  href?: string;
  loading?: boolean;
}

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDisplay(
  value: number,
  format: AnimatedKpiCardProps['format'],
): string {
  if (format === 'currency') {
    return formatTry(value);
  }
  if (format === 'percent') {
    return `${value.toFixed(1)}%`;
  }
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
}

export function AnimatedKpiCard({
  title,
  numericValue,
  format,
  change,
  changeCaption,
  icon,
  color,
  href,
  loading = false,
}: AnimatedKpiCardProps): ReactElement {
  const animated = useCountUp(loading ? 0 : numericValue);
  const display = loading ? '—' : formatDisplay(animated, format);

  return (
    <KpiWidget
      title={title}
      value={display}
      change={change}
      changeCaption={changeCaption}
      icon={icon}
      color={color}
      href={href}
      loading={loading}
    />
  );
}
