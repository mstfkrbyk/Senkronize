import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ExternalLink, Loader2, UserPlus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { OrgProductLineBadges } from '@/components/OrgProductLineBadges';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  TRIAL_EXTEND_DAYS,
  TRIAL_EXTEND_REASON,
  trialEndsAtPlusDays,
} from '@/lib/admin-trial-extension';
import { asArray } from '@/lib/admin-api-normalize';
import {
  ADMIN_PLAN_TIERS,
  ADMIN_PRODUCT_SELECTIONS,
  ADMIN_SUBSCRIPTION_STATUSES,
  adminAccountingModeLabel,
  adminPlanTierLabel,
  adminProductSelectionLabel,
  adminSubscriptionStatusLabel,
} from '@/lib/admin-i18n-labels';
import { ACCOUNTING_MODE_OPTIONS } from '@/lib/accounting-mode-options';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  adminOrganizationsByPartnerUrl,
  adminPartnerPageHash,
  isDemoPartnerSlug,
} from '@/lib/admin-partner-nav';
import { useAdminPartners } from '@/pages/partner/hooks/usePartnerLink';
import type {
  AdminChangeAccountingModePayload,
  AdminOrgDetailPartnerLink,
  AdminOrganizationDetailResponse,
  AdminPartnerRow,
  AdminProductSelection,
  AdminUpdateSubscriptionPayload,
  SubStatus,
} from '@/types/admin';
import type { AccountingMode, OrgPlanTier, OrgProductLine } from '@/types/auth';

const PLATFORM_ORG_SLUG = 'senkronize-platform';

function toDateInputValue(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toISOString().slice(0, 10);
}

function resolveProductSelection(
  orgProducts: string[],
): AdminProductSelection {
  const hasInt = orgProducts.includes('INTEGRATION');
  const hasAcc = orgProducts.includes('ACCOUNTING');
  if (hasInt && hasAcc) {
    return 'BUNDLE';
  }
  if (hasAcc) {
    return 'ACCOUNTING';
  }
  return 'INTEGRATION';
}

type Props = {
  orgId: string;
  data: AdminOrganizationDetailResponse;
};

export function AdminOrgSettingsPanel({ orgId, data }: Props): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: partnersRaw } = useAdminPartners();
  const partners = useMemo(
    () => asArray<AdminPartnerRow>(partnersRaw),
    [partnersRaw],
  );
  const activePartners = useMemo(
    () => asArray<AdminOrgDetailPartnerLink>(data.activePartners),
    [data.activePartners],
  );
  const orgProducts = useMemo(
    () => asArray<OrgProductLine>(data.orgProducts),
    [data.orgProducts],
  );

  const [planOpen, setPlanOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<OrgPlanTier>('GELISIM');
  const [planReason, setPlanReason] = useState('');

  const [productOpen, setProductOpen] = useState(false);
  const [productSelection, setProductSelection] = useState<AdminProductSelection>(
    'BUNDLE',
  );
  const [productReason, setProductReason] = useState('');

  const [accountingModeOpen, setAccountingModeOpen] = useState(false);
  const [newAccountingMode, setNewAccountingMode] = useState<AccountingMode>('NATIVE');
  const [accountingModeReason, setAccountingModeReason] = useState('');

  const [partnerAssignOpen, setPartnerAssignOpen] = useState(false);
  const [partnerOrgId, setPartnerOrgId] = useState('');
  const [partnerReason, setPartnerReason] = useState('');

  const [subStatus, setSubStatus] = useState<SubStatus>(
    data.subscription?.status ?? 'ACTIVE',
  );
  const [trialEndsAt, setTrialEndsAt] = useState(
    toDateInputValue(data.subscription?.trialEndsAt ?? null),
  );
  const [subscriptionReason, setSubscriptionReason] = useState('');

  const isDirect = data.organization.type === 'DIRECT';
  const isPlatformOrg = data.organization.slug === PLATFORM_ORG_SLUG;
  const isInternal = data.internalAccount || data.billingExempt || isPlatformOrg;
  const currentProduct = useMemo(
    () => resolveProductSelection(orgProducts),
    [orgProducts],
  );
  const resolvedAccountingMode = useMemo((): AccountingMode => {
    if (
      data.accountingMode === 'NATIVE' ||
      data.accountingMode === 'EXTERNAL_ERP'
    ) {
      return data.accountingMode;
    }
    return data.activeErpConnectionCount > 0 ? 'EXTERNAL_ERP' : 'NATIVE';
  }, [data.accountingMode, data.activeErpConnectionCount]);
  const nativeAccountingBlocked =
    newAccountingMode === 'NATIVE' && data.activeErpConnectionCount > 0;
  const storedAccountingMode =
    data.accountingMode === 'NATIVE' || data.accountingMode === 'EXTERNAL_ERP'
      ? data.accountingMode
      : null;
  const accountingModeUnchanged = storedAccountingMode === newAccountingMode;

  const invalidateDetail = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'organization', orgId] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
  };

  const closePartnerAssignDialog = (): void => {
    setPartnerAssignOpen(false);
    setPartnerOrgId('');
    setPartnerReason('');
  };

  const changePlanMutation = useMutation({
    mutationFn: async (payload: { plan: OrgPlanTier; reason: string }) => {
      await api.patch(`/admin/organizations/${orgId}/plan`, payload);
    },
    onSuccess: () => {
      toast.success(t('admin.pages.orgSettings.toast.planUpdated'));
      setPlanOpen(false);
      setPlanReason('');
      invalidateDetail();
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const changeProductMutation = useMutation({
    mutationFn: async (payload: {
      productSelection: AdminProductSelection;
      reason: string;
    }) => {
      await api.patch(`/admin/organizations/${orgId}/product-lines`, payload);
    },
    onSuccess: () => {
      toast.success(t('admin.pages.orgSettings.toast.productLineUpdated'));
      setProductOpen(false);
      setProductReason('');
      invalidateDetail();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const changeAccountingModeMutation = useMutation({
    mutationFn: async (payload: AdminChangeAccountingModePayload) => {
      await api.patch(`/admin/organizations/${orgId}/accounting-mode`, payload);
    },
    onSuccess: (_data, payload) => {
      queryClient.setQueryData<AdminOrganizationDetailResponse>(
        ['admin', 'organization', orgId],
        (prev) =>
          prev
            ? { ...prev, accountingMode: payload.accountingMode }
            : prev,
      );
      toast.success(t('admin.pages.orgSettings.toast.accountingModeUpdated'));
      setAccountingModeOpen(false);
      setAccountingModeReason('');
      invalidateDetail();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const assignPartnerMutation = useMutation({
    mutationFn: async (payload: { partnerOrgId: string; reason?: string }) => {
      await api.put(`/admin/organizations/${orgId}/partner`, payload);
    },
    onSuccess: () => {
      toast.success(t('admin.pages.orgSettings.toast.partnerAssigned'));
      closePartnerAssignDialog();
      invalidateDetail();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async (payload: AdminUpdateSubscriptionPayload) => {
      await api.patch(`/admin/organizations/${orgId}/subscription`, payload);
    },
    onSuccess: () => {
      toast.success(t('admin.pages.orgSettings.toast.subscriptionUpdated'));
      setSubscriptionReason('');
      invalidateDetail();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const extendTrialMutation = useMutation({
    mutationFn: async () => {
      const trialEndsAtIso = data.subscription?.trialEndsAt ?? null;
      await api.patch(`/admin/organizations/${orgId}/subscription`, {
        trialEndsAt: trialEndsAtPlusDays(trialEndsAtIso, TRIAL_EXTEND_DAYS),
        reason: TRIAL_EXTEND_REASON,
      });
    },
    onSuccess: () => {
      const nextIso = trialEndsAtPlusDays(
        data.subscription?.trialEndsAt ?? null,
        TRIAL_EXTEND_DAYS,
      );
      setTrialEndsAt(toDateInputValue(nextIso));
      toast.success(t('admin.pages.orgSettings.toast.trialExtended'));
      invalidateDetail();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const removePartnerMutation = useMutation({
    mutationFn: async (partnerId: string) => {
      await api.delete(`/admin/organizations/${orgId}/partner/${partnerId}`);
    },
    onSuccess: () => {
      toast.success(t('admin.pages.orgSettings.toast.partnerRemoved'));
      invalidateDetail();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const assignablePartners = useMemo(() => {
    const linkedPartnerIds = new Set(
      activePartners.map((p) => p.partnerOrgId).filter(Boolean),
    );
    return partners
      .filter((p) => p.id && !linkedPartnerIds.has(p.id))
      .slice()
      .sort((a, b) => {
        const aDemo = a.isDemo || isDemoPartnerSlug(a.slug);
        const bDemo = b.isDemo || isDemoPartnerSlug(b.slug);
        if (aDemo !== bDemo) {
          return aDemo ? 1 : -1;
        }
        return (a.name ?? '').localeCompare(b.name ?? '', 'tr');
      });
  }, [partners, activePartners]);
  const selectedPartner = assignablePartners.find((p) => p.id === partnerOrgId);

  const [internalReason, setInternalReason] = useState(
    t('admin.pages.orgSettings.internalAccountDefaultReason'),
  );

  const configureInternalMutation = useMutation({
    mutationFn: async (payload: {
      enabled: boolean;
      plan?: OrgPlanTier;
      reason: string;
    }) => {
      await api.patch(`/admin/organizations/${orgId}/internal-account`, payload);
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.enabled
          ? t('admin.pages.orgSettings.toast.internalAccountEnabled')
          : t('admin.pages.orgSettings.toast.internalAccountDisabled'),
      );
      invalidateDetail();
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const currentSub = data.subscription;
  const subscriptionDirty = (() => {
    if (currentSub == null) return false;
    return (
      subStatus !== currentSub.status ||
      (subStatus === 'TRIAL' &&
        trialEndsAt !== toDateInputValue(currentSub.trialEndsAt))
    );
  })();

  const handleSaveSubscription = (): void => {
    if (!currentSub) {
      return;
    }
    const payload: AdminUpdateSubscriptionPayload = {
      reason: subscriptionReason.trim(),
    };
    if (subStatus !== currentSub.status) {
      payload.status = subStatus;
    }
    if (subStatus === 'TRIAL') {
      const currentTrial = toDateInputValue(currentSub.trialEndsAt);
      if (trialEndsAt !== currentTrial && trialEndsAt.length > 0) {
        const nextTrial = new Date(`${trialEndsAt}T12:00:00.000Z`);
        if (Number.isNaN(nextTrial.getTime())) {
          toast.error(t('admin.pages.orgSettings.toast.invalidTrialDate'));
          return;
        }
        payload.trialEndsAt = nextTrial.toISOString();
      }
    }
    updateSubscriptionMutation.mutate(payload);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.pages.orgSettings.subscriptionTitle')}</CardTitle>
          <CardDescription>{t('admin.pages.orgSettings.subscriptionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.subscription ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('admin.pages.orgSettings.planLabel')}</span>
                <Badge variant="secondary">
                  {adminPlanTierLabel(data.subscription.plan, t)}
                </Badge>
                {isInternal ? (
                  <Badge variant="outline" className="border-sky-500/60 text-sky-800">
                    {t('admin.pages.orgSettings.internalAccountBadge')}
                  </Badge>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const sub = data.subscription;
                    if (!sub) {
                      return;
                    }
                    setNewPlan(sub.plan);
                    setPlanOpen(true);
                  }}
                >
                  {t('admin.pages.orgSettings.changePlan')}
                </Button>
              </div>

              {isInternal ? (
                <Alert className="border-sky-200 bg-sky-50/80 text-sky-950">
                  <AlertTitle>{t('admin.pages.orgSettings.internalAccountTitle')}</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>{t('admin.pages.orgSettings.internalAccountDescription')}</p>
                    {data.internalAccount && data.billingExempt ? (
                      <p className="text-sm font-medium">
                        {t('admin.pages.orgSettings.internalAccountActive')}
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="admin-internal-reason">
                        {t('admin.pages.orgSettings.internalAccountReason')}
                      </Label>
                      <Textarea
                        id="admin-internal-reason"
                        value={internalReason}
                        onChange={(e) => setInternalReason(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        configureInternalMutation.isPending ||
                        internalReason.trim().length === 0
                      }
                      onClick={() => {
                        configureInternalMutation.mutate({
                          enabled: true,
                          plan: data.subscription?.plan ?? 'KURUMSAL',
                          reason: internalReason.trim(),
                        });
                      }}
                    >
                      {t('admin.pages.orgSettings.applyInternalAccount')}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-3 rounded-md border border-border p-4">
                  <p className="text-sm font-medium">{t('admin.pages.orgSettings.subscriptionStatus')}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="admin-sub-status">{t('admin.pages.orgSettings.statusLabel')}</Label>
                      <Select
                        value={subStatus}
                        onValueChange={(v) => setSubStatus(v as SubStatus)}
                      >
                        <SelectTrigger id="admin-sub-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ADMIN_SUBSCRIPTION_STATUSES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {adminSubscriptionStatusLabel(value, t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {subStatus === 'TRIAL' ? (
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="admin-trial-ends">{t('admin.pages.orgSettings.trialEndsLabel')}</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            id="admin-trial-ends"
                            type="date"
                            className="max-w-[12.5rem]"
                            value={trialEndsAt}
                            onChange={(e) => setTrialEndsAt(e.target.value)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              currentSub?.status !== 'TRIAL' ||
                              extendTrialMutation.isPending
                            }
                            onClick={() => extendTrialMutation.mutate()}
                          >
                            {extendTrialMutation.isPending ? (
                              <Loader2
                                className="mr-2 size-4 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <CalendarPlus className="mr-2 size-4" aria-hidden />
                            )}
                            {t('admin.pages.orgSettings.extendTrial')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-end text-sm text-muted-foreground">
                        {t('admin.pages.orgSettings.currentStatus')}{' '}
                        {adminSubscriptionStatusLabel(data.subscription.status, t)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-sub-reason">{t('admin.common.reason')}</Label>
                    <Textarea
                      id="admin-sub-reason"
                      rows={2}
                      value={subscriptionReason}
                      onChange={(e) => setSubscriptionReason(e.target.value)}
                      placeholder={t('admin.pages.orgSettings.reasonPlaceholder')}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      !subscriptionDirty ||
                      subscriptionReason.trim().length === 0 ||
                      updateSubscriptionMutation.isPending ||
                      (subStatus === 'TRIAL' && trialEndsAt.length === 0)
                    }
                    onClick={handleSaveSubscription}
                  >
                    {updateSubscriptionMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    ) : null}
                    {t('admin.pages.orgSettings.saveSubscription')}
                  </Button>
                </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('admin.pages.orgSettings.noSubscription')}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('admin.pages.orgSettings.productLineLabel')}</span>
            <OrgProductLineBadges orgProducts={orgProducts} />
            <Badge variant="outline" className="font-normal">
              {t('admin.pages.orgSettings.accountingPrefix')}{' '}
              {adminAccountingModeLabel(resolvedAccountingMode, t)}
              {data.accountingMode == null ? t('admin.pages.orgSettings.accountingResolved') : ''}
            </Badge>
            {data.activeErpConnectionCount > 0 ? (
              <span className="text-xs text-muted-foreground">
                {t('admin.pages.orgSettings.activeErpCount', {
                  count: data.activeErpConnectionCount,
                })}
              </span>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setNewAccountingMode(resolvedAccountingMode);
                setAccountingModeReason('');
                setAccountingModeOpen(true);
              }}
            >
              {t('admin.pages.orgSettings.changeAccountingMode')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setProductSelection(currentProduct);
                setProductOpen(true);
              }}
            >
              {t('admin.pages.orgSettings.changeProductLine')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isDirect ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin.pages.orgSettings.partnerAssignTitle')}</CardTitle>
            <CardDescription>{t('admin.pages.orgSettings.partnerAssignDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activePartners.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.pages.orgSettings.noActivePartner')}
              </p>
            ) : (
              <ul className="space-y-2">
                {activePartners.map((p) => (
                  <li
                    key={p.relationshipId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        <Link
                          to={`/admin/partners${adminPartnerPageHash(p.partnerOrgId)}`}
                          className="text-sky-700 underline-offset-2 hover:underline"
                        >
                          {p.name}
                        </Link>
                      </p>
                      <p className="text-xs text-muted-foreground">@{p.slug}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('admin.pages.orgSettings.commission', { pct: p.commissionPct })}
                        {p.canImpersonate ? t('admin.pages.orgSettings.impersonationOn') : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link to={adminOrganizationsByPartnerUrl(p.partnerOrgId)}>
                          <ExternalLink className="mr-1 size-3.5" aria-hidden />
                          {t('admin.pages.orgSettings.clients')}
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={removePartnerMutation.isPending}
                        onClick={() => removePartnerMutation.mutate(p.partnerOrgId)}
                      >
                        <X className="mr-1 size-4" aria-hidden />
                        {t('admin.pages.orgSettings.remove')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {partners.length === 0 ? (
              <p className="text-sm text-amber-800">
                {t('admin.pages.orgSettings.noPartnersInSystem')}
              </p>
            ) : assignablePartners.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.pages.orgSettings.allPartnersAssigned')}
              </p>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPartnerOrgId('');
                  setPartnerReason('');
                  setPartnerAssignOpen(true);
                }}
              >
                <UserPlus className="mr-2 size-4" aria-hidden />
                {t('admin.pages.orgSettings.assignPartner')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin.pages.orgSettings.partnerOrgTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('admin.pages.orgSettings.partnerOrgDescription')}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.pages.orgSettings.changePlanTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t('admin.pages.orgSettings.newPlan')}</Label>
              <Select
                value={newPlan}
                onValueChange={(v) => setNewPlan(v as OrgPlanTier)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_PLAN_TIERS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {adminPlanTierLabel(value, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-plan-reason">{t('admin.common.reason')}</Label>
              <Textarea
                id="admin-plan-reason"
                rows={3}
                value={planReason}
                onChange={(e) => setPlanReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPlanOpen(false)}>
              {t('admin.common.dismiss')}
            </Button>
            <Button
              type="button"
              disabled={
                changePlanMutation.isPending || planReason.trim().length === 0
              }
              onClick={() =>
                changePlanMutation.mutate({
                  plan: newPlan,
                  reason: planReason.trim(),
                })
              }
            >
              {t('admin.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={partnerAssignOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePartnerAssignDialog();
            return;
          }
          setPartnerAssignOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.pages.orgSettings.assignPartnerTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.pages.orgSettings.assignPartnerDescription', {
                orgName: data.organization.name,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="admin-partner-select">{t('admin.pages.orgSettings.partnerOrgSelect')}</Label>
              <Select value={partnerOrgId || undefined} onValueChange={setPartnerOrgId}>
                <SelectTrigger id="admin-partner-select">
                  <SelectValue placeholder={t('admin.pages.orgSettings.partnerSelectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {assignablePartners.map((p) => {
                    const isDemo = p.isDemo || isDemoPartnerSlug(p.slug);
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (@{p.slug})
                        {isDemo ? t('admin.pages.orgSettings.demoSuffix') : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {selectedPartner ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{selectedPartner.name}</p>
                    <p className="text-xs text-muted-foreground">
                      @{selectedPartner.slug}
                    </p>
                  </div>
                  {(selectedPartner.isDemo ||
                    isDemoPartnerSlug(selectedPartner.slug)) ? (
                    <Badge variant="outline" className="font-normal">
                      {t('admin.pages.partners.demo')}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground">
                  {t('admin.pages.orgSettings.commissionActiveClients', {
                    rate:
                      typeof selectedPartner.commissionRate === 'number'
                        ? selectedPartner.commissionRate.toFixed(2)
                        : t('admin.common.emDash'),
                    count: selectedPartner.activeClientCount ?? 0,
                  })}
                </p>
                <Button type="button" variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link
                    to={`/admin/partners${adminPartnerPageHash(selectedPartner.id)}`}
                  >
                    {t('admin.pages.orgSettings.goToPartnerProfile')}
                    <ExternalLink className="ml-1 size-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('admin.pages.orgSettings.selectPartnerHint')}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="partner-reason">{t('admin.pages.orgSettings.optionalNote')}</Label>
              <Textarea
                id="partner-reason"
                rows={2}
                value={partnerReason}
                onChange={(e) => setPartnerReason(e.target.value)}
                placeholder={t('admin.pages.orgSettings.auditNotePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePartnerAssignDialog}>
              {t('admin.common.dismiss')}
            </Button>
            <Button
              type="button"
              disabled={!partnerOrgId || assignPartnerMutation.isPending}
              onClick={() =>
                assignPartnerMutation.mutate({
                  partnerOrgId,
                  reason: partnerReason.trim() || undefined,
                })
              }
            >
              {assignPartnerMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {t('admin.pages.orgSettings.assignPartnerConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accountingModeOpen} onOpenChange={setAccountingModeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.pages.orgSettings.changeAccountingTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.pages.orgSettings.changeAccountingDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t('admin.pages.orgSettings.newMode')}</Label>
              <Select
                value={newAccountingMode}
                onValueChange={(v) => setNewAccountingMode(v as AccountingMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTING_MODE_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {adminAccountingModeLabel(o.id, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {nativeAccountingBlocked ? (
              <Alert variant="destructive">
                <AlertTitle>{t('admin.pages.orgSettings.nativeBlockedTitle')}</AlertTitle>
                <AlertDescription>
                  {t('admin.pages.orgSettings.nativeBlockedDescription', {
                    count: data.activeErpConnectionCount,
                  })}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="admin-accounting-mode-reason">{t('admin.common.reason')}</Label>
              <Textarea
                id="admin-accounting-mode-reason"
                rows={3}
                value={accountingModeReason}
                onChange={(e) => setAccountingModeReason(e.target.value)}
                placeholder={t('admin.pages.orgSettings.reasonPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAccountingModeOpen(false)}
            >
              {t('admin.common.dismiss')}
            </Button>
            <Button
              type="button"
              disabled={
                changeAccountingModeMutation.isPending ||
                accountingModeReason.trim().length === 0 ||
                nativeAccountingBlocked ||
                accountingModeUnchanged
              }
              onClick={() =>
                changeAccountingModeMutation.mutate({
                  accountingMode: newAccountingMode,
                  reason: accountingModeReason.trim(),
                })
              }
            >
              {changeAccountingModeMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {t('admin.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.pages.orgSettings.changeProductTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t('admin.pages.orgSettings.productSelection')}</Label>
              <Select
                value={productSelection}
                onValueChange={(v) =>
                  setProductSelection(v as AdminProductSelection)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_PRODUCT_SELECTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {adminProductSelectionLabel(value, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-product-reason">{t('admin.common.reason')}</Label>
              <Textarea
                id="admin-product-reason"
                rows={3}
                value={productReason}
                onChange={(e) => setProductReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProductOpen(false)}
            >
              {t('admin.common.dismiss')}
            </Button>
            <Button
              type="button"
              disabled={
                changeProductMutation.isPending ||
                productReason.trim().length === 0
              }
              onClick={() =>
                changeProductMutation.mutate({
                  productSelection,
                  reason: productReason.trim(),
                })
              }
            >
              {t('admin.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
