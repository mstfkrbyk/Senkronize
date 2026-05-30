import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getMarketplaceRegion,
  groupMarketplacePlatformsByRegion,
  MARKETPLACE_REGION_LABEL_KEYS,
} from '@/lib/marketplace-regions';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { ErpConnectionDto } from '@/hooks/useErpConnections';
import type { MarketplaceConnectionDto } from '@/types/connection';

import { ConnectionsTable } from './ConnectionsTable';
import type { UnifiedConnectionRow } from './connection-utils';

interface Props {
  rows: UnifiedConnectionRow[];
  marketplaceConnections: MarketplaceConnectionDto[];
  erpConnections: ErpConnectionDto[];
  onEditMarketplace: (c: MarketplaceConnectionDto) => void;
  onEditErp: (c: ErpConnectionDto) => void;
  groupByRegion?: boolean;
}

function rowMatchesSearch(row: UnifiedConnectionRow, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) {
    return true;
  }
  const branding = getMarketplaceBranding(row.platform);
  const haystack = [
    row.name,
    row.platform,
    branding.label,
    row.platform.replaceAll('_', ' '),
  ]
    .join(' ')
    .toLocaleLowerCase('tr-TR');
  return haystack.includes(q);
}

export function ConnectionsChannelPanel({
  rows,
  marketplaceConnections,
  erpConnections,
  onEditMarketplace,
  onEditErp,
  groupByRegion = false,
}: Props): ReactElement {
  const { t } = useTranslation();
  const [queryInput, setQueryInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const filteredRows = useMemo(
    () => rows.filter((r) => rowMatchesSearch(r, appliedQuery)),
    [rows, appliedQuery],
  );

  const regionSections = useMemo(() => {
    if (!groupByRegion) {
      return null;
    }
    const platformIds = [...new Set(filteredRows.map((r) => r.platform))];
    const groups = groupMarketplacePlatformsByRegion(platformIds);
    return groups
      .map((g) => ({
        regionId: g.regionId,
        rows: filteredRows.filter((r) => getMarketplaceRegion(r.platform) === g.regionId),
      }))
      .filter((s) => s.rows.length > 0);
  }, [filteredRows, groupByRegion]);

  const runSearch = (): void => {
    setAppliedQuery(queryInput);
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t('connections.channelPanel.emptyCategory')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 gap-2">
          <Input
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
            placeholder={t('connections.channelPanel.searchPlaceholder')}
            aria-label={t('connections.channelPanel.searchPlaceholder')}
          />
          <Button type="button" variant="secondary" className="shrink-0 gap-1" onClick={runSearch}>
            <Search className="size-4" aria-hidden />
            {t('common.search')}
          </Button>
        </div>
        {appliedQuery ? (
          <p className="text-xs text-muted-foreground sm:pb-2">
            {t('connections.channelPanel.results', { count: filteredRows.length })}
          </p>
        ) : null}
      </div>

      {filteredRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('connections.platformSearch.empty')}</p>
      ) : groupByRegion && regionSections ? (
        <div className="space-y-8">
          {regionSections.map((section) => (
            <section key={section.regionId}>
              <h3 className="mb-3 text-sm font-semibold text-primary">
                {t(MARKETPLACE_REGION_LABEL_KEYS[section.regionId])}
                <span className="ml-2 font-normal text-muted-foreground">
                  ({section.rows.length})
                </span>
              </h3>
              <ConnectionsTable
                rows={section.rows}
                marketplaceConnections={marketplaceConnections}
                erpConnections={erpConnections}
                onEditMarketplace={onEditMarketplace}
                onEditErp={onEditErp}
              />
            </section>
          ))}
        </div>
      ) : (
        <ConnectionsTable
          rows={filteredRows}
          marketplaceConnections={marketplaceConnections}
          erpConnections={erpConnections}
          onEditMarketplace={onEditMarketplace}
          onEditErp={onEditErp}
        />
      )}
    </div>
  );
}
