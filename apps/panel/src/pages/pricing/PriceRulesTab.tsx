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
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  useDeletePricingRule,
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
  onDelete,
  togglePending,
  deletePending,
  activeLabel,
  passiveLabel,
  editLabel,
  deleteLabel,
}: {
  rule: PricingRule;
  onEdit: (rule: PricingRule) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (rule: PricingRule) => void;
  togglePending: boolean;
  deletePending: boolean;
  activeLabel: string;
  passiveLabel: string;
  editLabel: string;
  deleteLabel: string;
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
          aria-label="Reorder"
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
          {rule.isActive ? activeLabel : passiveLabel}
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
            aria-label={`${rule.name} active`}
          />
          <Button type="button" size="icon" variant="ghost" onClick={() => onEdit(rule)}>
            <Pencil className="h-4 w-4" aria-hidden />
            <span className="sr-only">{editLabel}</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={deletePending}
            onClick={() => onDelete(rule)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">{deleteLabel}</span>
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
  const { t } = useTranslation();
  const rulesQuery = usePricingRules(proAccess);
  const patchActive = useUpdatePricingRuleActive();
  const updateRule = useUpdatePricingRule();
  const deleteRule = useDeletePricingRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PricingRule | null>(null);

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

  const confirmDelete = (): void => {
    if (deleteTarget == null) {
      return;
    }
    deleteRule.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  if (!proAccess) {
    return (
      <UpgradePrompt
        feature={t('pricing.upgrade.rulesFeature')}
        requiredPlan="PRO"
        currentPlan={plan}
        description={t('pricing.upgrade.rulesDesc')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t('pricing.rules.priorityHint')}</p>
        <Button type="button" className="shrink-0 gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('pricing.rules.createRule')}
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
          {t('pricing.rules.empty')}
        </p>
      ) : null}

      {!rulesQuery.isLoading && sortedRules.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>{t('pricing.rules.ruleName')}</TableHead>
                  <TableHead>{t('pricing.rules.type')}</TableHead>
                  <TableHead>{t('pricing.common.platform')}</TableHead>
                  <TableHead>{t('pricing.buybox.status')}</TableHead>
                  <TableHead>{t('pricing.rules.priority')}</TableHead>
                  <TableHead className="text-right">{t('pricing.rules.actions')}</TableHead>
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
                      onDelete={setDeleteTarget}
                      togglePending={patchActive.isPending}
                      deletePending={deleteRule.isPending}
                      activeLabel={t('pricing.common.active')}
                      passiveLabel={t('pricing.common.passive')}
                      editLabel={t('pricing.common.edit')}
                      deleteLabel={t('pricing.common.delete')}
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
          {t('pricing.rules.savingPriority')}
        </div>
      ) : null}

      <PriceRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
      />

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pricing.rules.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pricing.rules.deleteDesc', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('pricing.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRule.isPending}
              onClick={confirmDelete}
            >
              {t('pricing.common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
