import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { SalesPeriodPreset } from '../report-utils';

interface Props {
  preset: SalesPeriodPreset;
  startDate: string;
  endDate: string;
  onPresetChange: (preset: SalesPeriodPreset) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

const PRESETS: { key: SalesPeriodPreset; labelKey: string }[] = [
  { key: 'week', labelKey: 'reports.period.week' },
  { key: 'month', labelKey: 'reports.period.month' },
  { key: '3month', labelKey: 'reports.period.3month' },
  { key: 'custom', labelKey: 'reports.period.custom' },
];

export function ReportPeriodSelector({
  preset,
  startDate,
  endDate,
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
}: Props): ReactElement {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(({ key, labelKey }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={preset === key ? 'default' : 'outline'}
            onClick={() => onPresetChange(key)}
          >
            {t(labelKey)}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="report-period-start">{t('reports.period.start')}</Label>
          <Input
            id="report-period-start"
            type="date"
            value={startDate}
            onChange={(e) => {
              onStartDateChange(e.target.value);
              onPresetChange('custom');
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-period-end">{t('reports.period.end')}</Label>
          <Input
            id="report-period-end"
            type="date"
            value={endDate}
            onChange={(e) => {
              onEndDateChange(e.target.value);
              onPresetChange('custom');
            }}
          />
        </div>
      </div>
    </div>
  );
}
