import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  filterPlatformIdsBySearch,
  groupMarketplacePlatformsByRegion,
  MARKETPLACE_REGION_LABEL_KEYS,
  type MarketplaceRegionId,
} from '@/lib/marketplace-regions';
import { getErpDisplay, getMarketplaceDisplay } from '@/lib/platform-display';

export type PlatformPickerLayout = 'byRegion' | 'flat';

interface PlatformPickerProps {
  platformIds: readonly string[];
  value: string;
  onChange: (platformId: string) => void;
  layout?: PlatformPickerLayout;
  kind: 'marketplace' | 'erp';
  idPrefix?: string;
}

function labelFor(kind: PlatformPickerProps['kind'], platformId: string): string {
  return kind === 'erp'
    ? getErpDisplay(platformId).label
    : getMarketplaceDisplay(platformId).label;
}

function PlatformTile({
  platformId,
  selected,
  kind,
  onSelect,
}: {
  platformId: string;
  selected: boolean;
  kind: PlatformPickerProps['kind'];
  onSelect: () => void;
}): ReactElement {
  const display = kind === 'erp' ? getErpDisplay(platformId) : getMarketplaceDisplay(platformId);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-xs transition-colors',
        selected
          ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500/40'
          : 'border-border bg-card hover:border-sky-300 hover:bg-muted/40',
      )}
    >
      <span className="text-2xl leading-none" aria-hidden>
        {display.logo}
      </span>
      <span className="line-clamp-2 font-medium text-foreground">{display.label}</span>
    </button>
  );
}

function PlatformGrid({
  ids,
  value,
  kind,
  onChange,
}: {
  ids: string[];
  value: string;
  kind: PlatformPickerProps['kind'];
  onChange: (id: string) => void;
}): ReactElement {
  if (ids.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        —
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ids.map((id) => (
        <PlatformTile
          key={id}
          platformId={id}
          selected={value === id}
          kind={kind}
          onSelect={() => {
            onChange(id);
          }}
        />
      ))}
    </div>
  );
}

export function PlatformPicker({
  platformIds,
  value,
  onChange,
  layout = 'byRegion',
  kind,
  idPrefix = 'platform',
}: PlatformPickerProps): ReactElement {
  const { t } = useTranslation();
  const [queryInput, setQueryInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const filteredIds = useMemo(
    () =>
      filterPlatformIdsBySearch(platformIds, appliedQuery, (id) => labelFor(kind, id)),
    [platformIds, appliedQuery, kind],
  );

  const regionGroups = useMemo(() => {
    if (layout !== 'byRegion') {
      return null;
    }
    return groupMarketplacePlatformsByRegion(filteredIds);
  }, [filteredIds, layout]);

  const runSearch = (): void => {
    setAppliedQuery(queryInput);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-search`}>{t('connections.platformSearch.label')}</Label>
        <div className="flex gap-2">
          <Input
            id={`${idPrefix}-search`}
            value={queryInput}
            onChange={(e) => {
              setQueryInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runSearch();
              }
            }}
            placeholder={t('connections.platformSearch.placeholder')}
          />
          <Button type="button" variant="secondary" className="shrink-0 gap-1" onClick={runSearch}>
            <Search className="size-4" aria-hidden />
            {t('common.search')}
          </Button>
        </div>
        {appliedQuery ? (
          <p className="text-xs text-muted-foreground">
            {t('connections.platformSearch.results', { count: filteredIds.length })}
          </p>
        ) : null}
      </div>

      {filteredIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('connections.platformSearch.empty')}</p>
      ) : layout === 'flat' || kind === 'erp' ? (
        <PlatformGrid ids={filteredIds} value={value} kind={kind} onChange={onChange} />
      ) : (
        <div className="max-h-[min(22rem,50vh)] space-y-4 overflow-y-auto pr-1">
          {regionGroups?.map((group) => (
            <RegionSection
              key={group.regionId}
              regionId={group.regionId}
              platformIds={group.platformIds}
              value={value}
              kind={kind}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RegionSection({
  regionId,
  platformIds,
  value,
  kind,
  onChange,
}: {
  regionId: MarketplaceRegionId;
  platformIds: string[];
  value: string;
  kind: PlatformPickerProps['kind'];
  onChange: (id: string) => void;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t(MARKETPLACE_REGION_LABEL_KEYS[regionId])}
        <span className="ml-1 font-normal tabular-nums">({platformIds.length})</span>
      </h4>
      <PlatformGrid ids={platformIds} value={value} kind={kind} onChange={onChange} />
    </section>
  );
}
