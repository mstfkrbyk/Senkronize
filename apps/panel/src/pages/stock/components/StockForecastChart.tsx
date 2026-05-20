import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { StockForecastDataPoint } from '@/types/product';

export interface StockForecastData {
  date: string;
  actual?: number;
  forecast?: number;
  reorderPoint: number;
}

interface Props {
  data: StockForecastDataPoint[] | StockForecastData[];
  daysUntilStockout?: number | null;
  height?: number;
}

function stockoutStartIndex(
  rows: StockForecastDataPoint[],
): number | null {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const level = row.actual ?? row.forecast;
    if (level !== undefined && level <= 0) {
      return i;
    }
  }
  return null;
}

export function StockForecastChart({
  data,
  daysUntilStockout,
  height = 288,
}: Props): ReactElement {
  const chartRows = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: format(parseISO(d.date), 'd MMM', { locale: tr }),
      })),
    [data],
  );

  const stockoutIdx = stockoutStartIndex(data);
  const stockoutLabel =
    daysUntilStockout !== null &&
    daysUntilStockout !== undefined &&
    Number.isFinite(daysUntilStockout) &&
    daysUntilStockout >= 0
      ? `${Math.ceil(daysUntilStockout)} gün sonra tükeniyor`
      : null;

  const stockoutFromLabel =
    stockoutIdx !== null && stockoutIdx > 0
      ? chartRows[stockoutIdx]?.label
      : null;
  const stockoutToLabel =
    stockoutIdx !== null ? chartRows[chartRows.length - 1]?.label : null;

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Tahmin verisi yok.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) {
              return null;
            }
            const row = payload[0]?.payload as StockForecastDataPoint & {
              label: string;
            };
            const isStockout =
              stockoutLabel !== null &&
              row.actual !== undefined &&
              row.actual <= 0;
            return (
              <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
                <p className="font-medium">{label}</p>
                {row.actual !== undefined ? (
                  <p className="text-sky-700">Mevcut: {row.actual.toLocaleString('tr-TR')}</p>
                ) : null}
                {row.forecast !== undefined ? (
                  <p className="text-sky-500">Tahmin: {row.forecast.toLocaleString('tr-TR')}</p>
                ) : null}
                <p className="text-red-600">
                  Kritik: {row.reorderPoint.toLocaleString('tr-TR')}
                </p>
                {isStockout ? (
                  <p className="mt-1 font-medium text-red-700">{stockoutLabel}</p>
                ) : null}
              </div>
            );
          }}
        />
        <Legend />
        {stockoutFromLabel && stockoutToLabel ? (
          <ReferenceArea
            x1={stockoutFromLabel}
            x2={stockoutToLabel}
            fill="#fecaca"
            fillOpacity={0.35}
            strokeOpacity={0}
          />
        ) : null}
        <ReferenceLine
          y={data[0]?.reorderPoint ?? 0}
          stroke="#ef4444"
          strokeDasharray="6 4"
          label={{ value: 'Kritik seviye', position: 'insideTopRight', fontSize: 11 }}
        />
        <Area
          type="monotone"
          dataKey="actual"
          name="Mevcut stok"
          stroke="#0284c7"
          fill="#bae6fd"
          fillOpacity={0.25}
          strokeWidth={2}
          connectNulls={false}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Tahmin (AI)"
          stroke="#0284c7"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
