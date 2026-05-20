import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/TableSkeleton';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { getApiErrorMessage } from '@/lib/api';
import type { OrgPlanTier } from '@/types/auth';
import type { PricingRule, PricingStrategy } from '@/types/pricing';

import { PriceRuleDialog } from './PriceRuleDialog';
import {
  usePricingRules,
  useUpdatePricingRule,
  useUpdatePricingRuleActive,
} from './hooks/usePricing';

const STRATEGY_TYPE_LABELS: Record<PricingStrategy, string> = {
  MATCH_BUYBOX: 'BuyBox %',
  BEAT_BUYBOX: 'BuyBox %',
  AGGRESSIVE_BUYBOX: 'BuyBox %',
  FIXED_MARGIN: 'Markup',
  DYNAMIC: 'Markup',
  PROFIT_FOCUSED: 'BuyBox %',
  TIME_BASED: 'Markdown',
  STOCK_BASED: 'Markdown',
};

function SortableRuleRow({
  rule,
  onEdit,
  onToggle,
  togglePending,
}: {
  rule: PricingRule;
  onEdit: (rule: PricingRule) => void;
  onToggle: (id: string, active: boolean) => void;
  togglePending: boolean;
}): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const platformLabel =
    rule.platform === 'TRENDYOL'
      ? 'Trendyol'
      : rule.platform === 'HEPSIBURADA'
        ? 'Hepsiburada'
        : rule.platform;

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted/50' : undefined}>
      <TableCell className="w-10">
        <button
          type="button"
          className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md border bg-background active:cursor-grabbing"
          aria-label="Öncelik sırasını değiştir"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden />
        </button>
      </TableCell>
      <TableCell className="font-medium">{rule.name}</TableCell>
      <TableCell>
        <Badge variant="outline">{STRATEGY_TYPE_LABELS[rule.strategy] ?? rule.strategy}</Badge>
      </TableCell>
      <TableCell>{platformLabel}</TableCell>
      <TableCell>
        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
          {rule.isActive ? 'Aktif' : 'Pasif'}
        </Badge>
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {rule.targetPosition}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Switch
            checked={rule.isActive}
            disabled={togglePending}
            onCheckedChange={(c) => onToggle(rule.id, c)}
            aria-label={`${rule.name} aktif/pasif`}
          />
          <Button type="button" size="icon" variant="ghost" onClick={() => onEdit(rule)}>
            <Pencil className="h-4 w-4" aria-hidden />
            <span className="sr-only">Düzenle</span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface Props {
  proAccess: boolean;
  plan: OrgPlanTier | undefined;
}

export function PriceRulesTab({ proAccess, plan }: Props): ReactElement {
  const rulesQuery = usePricingRules(proAccess);
  const patchActive = useUpdatePricingRuleActive();
  const updateRule = useUpdatePricingRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  const rules = rulesQuery.data ?? [];

  const sortedRules = useMemo(() => {
    if (orderedIds.length === 0) {
      return [...rules].sort((a, b) => a.targetPosition - b.targetPosition);
    }
    const byId = new Map(rules.map((r) => [r.id, r]));
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter((r): r is PricingRule => r != null);
    const rest = rules.filter((r) => !orderedIds.includes(r.id));
    return [...ordered, ...rest];
  }, [rules, orderedIds]);

  useEffect(() => {
    if (rules.length === 0) {
      return;
    }
    const ids = [...rules]
      .sort((a, b) => a.targetPosition - b.targetPosition)
      .map((r) => r.id);
    setOrderedIds((prev) => {
      if (prev.length === ids.length && prev.every((id, i) => id === ids[i])) {
        return prev;
      }
      return ids;
    });
  }, [rulesQuery.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = sortedRules.findIndex((r) => r.id === active.id);
    const newIndex = sortedRules.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const reordered = arrayMove(sortedRules, oldIndex, newIndex);
    setOrderedIds(reordered.map((r) => r.id));
    reordered.forEach((rule, index) => {
      const position = index + 1;
      if (rule.targetPosition !== position) {
        updateRule.mutate({ id: rule.id, data: { targetPosition: position } });
      }
    });
  };

  const openCreate = (): void => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const openEdit = (rule: PricingRule): void => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  if (!proAccess) {
    return (
      <UpgradePrompt
        feature="Fiyat kuralları"
        requiredPlan="PRO"
        currentPlan={plan}
        description="Otomatik fiyat kuralları PRO ve Kurumsal paketlerde kullanılabilir."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Kurallar yukarıdan aşağıya öncelik sırasıyla uygulanır. Sürükleyerek sırayı değiştirin.
        </p>
        <Button type="button" className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          Kural oluştur
        </Button>
      </div>

      {rulesQuery.isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : null}
      {rulesQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(rulesQuery.error)}
        </div>
      ) : null}

      {!rulesQuery.isLoading && !rulesQuery.isError && rules.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Henüz fiyat kuralı yok. İlk kuralınızı oluşturun.
        </p>
      ) : null}

      {!rulesQuery.isLoading && sortedRules.length > 0 ? (
        <div className="rounded-md border overflow-x-auto">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Kural adı</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Öncelik</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={sortedRules.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedRules.map((rule) => (
                    <SortableRuleRow
                      key={rule.id}
                      rule={rule}
                      onEdit={openEdit}
                      onToggle={(id, active) => patchActive.mutate({ id, isActive: active })}
                      togglePending={patchActive.isPending}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>
      ) : null}

      {updateRule.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Skeleton className="h-4 w-4 rounded-full" />
          Öncelik kaydediliyor…
        </div>
      ) : null}

      <PriceRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
      />
    </div>
  );
}
