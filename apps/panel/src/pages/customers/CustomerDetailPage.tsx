import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  FileText,
  Info,
  Package,
  Pencil,
  Scale,
  ShoppingBag,
  ScrollText,
  StickyNote,
  Tag,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { platformLabel } from '@/pages/campaigns/campaign-labels';
import { CustomerStatementTab } from '@/pages/customers/components/CustomerStatementTab';
import { CustomerTagCombobox } from '@/pages/customers/components/CustomerTagCombobox';
import { ledgerBalanceClass } from '@/pages/customers/customer-ledger-utils';
import { customersT } from '@/pages/customers/translations';
import { useCustomerLedgerSummaries } from '@/pages/customers/useCustomerLedgerSummaries';
import {
  buildSpendingTrend,
  customerInitials,
  favoritePlatform,
  orderFrequencyLabel,
  parseNotesTimeline,
} from '@/pages/customers/customer-utils';
import {
  formatCustomerDate,
  formatTryAmount,
  primarySegment,
  SEGMENT_BADGE_CLASS,
  SEGMENT_LABELS,
} from '@/lib/customer-segments';
import { api, getApiErrorMessage } from '@/lib/api';
import { hasOrgProductLine } from '@/lib/org-products';
import {
  CreateManualInvoiceDialog,
  type ManualInvoiceCustomerPrefill,
} from '@/pages/invoices/CreateManualInvoiceDialog';
import { useAuthStore } from '@/store/auth.store';
import { ORDER_STATUS_I18N_KEY } from '@/lib/order-i18n';
import type { CustomerDetailDto } from '@/types/customer';
import type { OrderStatus } from '@/types/order';

export function CustomerDetailPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.customers'));
  const navigate = useNavigate();
  const { id: customerId } = useParams<{ id: string }>();
  const id = customerId ?? '';
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [profileNotes, setProfileNotes] = useState('');
  const [manualInvoiceOpen, setManualInvoiceOpen] = useState(false);

  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode, isLoading: accountingModeLoading } = useAccountingMode();
  const hasAccountingProduct = hasOrgProductLine(orgProducts, 'ACCOUNTING');
  const isNativeAccounting = accountingMode === 'NATIVE';
  const isExternalAccounting = accountingMode === 'EXTERNAL_ERP';
  const showNativeInvoice =
    hasAccountingProduct && isNativeAccounting && !accountingModeLoading;
  const showStatementTab = hasAccountingProduct && !accountingModeLoading;
  const showLedgerSummary =
    hasAccountingProduct && isNativeAccounting && !accountingModeLoading;
  const showExternalErpNote =
    hasAccountingProduct && isExternalAccounting && !accountingModeLoading;
  const [activeTab, setActiveTab] = useState('orders');

  const detailQuery = useQuery({
    queryKey: ['customer', id],
    enabled: id.length > 0,
    queryFn: async (): Promise<CustomerDetailDto> => {
      const { data } = await api.get<{ data: CustomerDetailDto }>(
        `/customers/${id}`,
      );
      return data.data;
    },
  });

  const ledgerSummariesQuery = useCustomerLedgerSummaries(
    id.length > 0 ? [id] : [],
    showLedgerSummary,
  );

  usePageTitle(detailQuery.data?.name ?? 'Müşteri');

  const tagMutation = useMutation({
    mutationFn: async (payload: {
      action: 'add' | 'remove';
      tag: string;
    }): Promise<void> => {
      await api.patch(`/customers/${id}/tags`, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customer', id] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const noteMutation = useMutation({
    mutationFn: async (note: string): Promise<void> => {
      await api.post(`/customers/${id}/notes`, { note });
    },
    onSuccess: async () => {
      toast.success('Not eklendi.');
      setNoteText('');
      await queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const profileNotesMutation = useMutation({
    mutationFn: async (notes: string): Promise<void> => {
      await api.patch(`/customers/${id}`, { notes });
    },
    onSuccess: async () => {
      toast.success('Notlar kaydedildi.');
      setEditingNotes(false);
      await queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const tagSuggestionsQuery = useQuery({
    queryKey: ['customers-tag-suggestions'],
    queryFn: async (): Promise<string[]> => {
      const { data } = await api.get<{ items: { tags: string[] }[] }>('/customers', {
        params: { limit: 100, page: 1 },
      });
      const tags = new Set<string>();
      for (const c of data.items) {
        for (const tag of c.tags) {
          tags.add(tag);
        }
      }
      return [...tags];
    },
    staleTime: 60_000,
  });

  const spendingTrend = useMemo(
    () =>
      detailQuery.data
        ? buildSpendingTrend(detailQuery.data.orders)
        : [],
    [detailQuery.data],
  );

  const noteTimeline = useMemo(
    () => parseNotesTimeline(detailQuery.data?.notes ?? null),
    [detailQuery.data?.notes],
  );

  const invoiceCustomerPrefill = useMemo((): ManualInvoiceCustomerPrefill | null => {
    const c = detailQuery.data;
    if (!c) {
      return null;
    }
    return {
      name: c.name,
      email: c.email,
      phone: c.phone,
    };
  }, [detailQuery.data]);

  const platformCounts = useMemo(() => {
    if (!detailQuery.data) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const o of detailQuery.data.orders) {
      counts.set(o.platform, (counts.get(o.platform) ?? 0) + 1);
    }
    return [...counts.entries()].map(([platform, count]) => ({
      platform,
      label: platformLabel(platform),
      count,
    }));
  }, [detailQuery.data]);

  if (!id) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={User}
            title="Geçersiz bağlantı"
            description="Müşteri seçilemedi."
          />
        </CardContent>
      </Card>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Skeleton className="h-[420px] w-full rounded-lg" />
              <div className="space-y-4 lg:col-span-2">
                <Skeleton className="h-10 w-full max-w-md" />
                <Skeleton className="h-64 w-full rounded-lg" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={User}
            title="Müşteri bulunamadı"
            description={getApiErrorMessage(detailQuery.error)}
          />
        </CardContent>
      </Card>
    );
  }

  const customer = detailQuery.data;
  const mainSegment = primarySegment(customer.segments);
  const favPlatform = favoritePlatform(customer.orders);
  const ledger = ledgerSummariesQuery.data?.[id];
  const ledgerLoading =
    showLedgerSummary &&
    (ledgerSummariesQuery.isLoading || ledgerSummariesQuery.isFetching);
  const ledgerFailed = showLedgerSummary && ledgerSummariesQuery.isError;

  const startEditNotes = (): void => {
    setProfileNotes(customer.notes ?? '');
    setEditingNotes(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description="Müşteri profili"
        context={navContextLine}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/customers">
              <ArrowLeft className="mr-2 size-4" />
              Müşterilere dön
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
              <Avatar className="size-16">
                <AvatarFallback className="text-lg">
                  {customerInitials(customer.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">{customer.name}</p>
                {mainSegment ? (
                  <Badge
                    variant="outline"
                    className={`mt-1 ${SEGMENT_BADGE_CLASS[mainSegment]}`}
                  >
                    {SEGMENT_LABELS[mainSegment]}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">E-posta</p>
                <p>{customer.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Telefon</p>
                <p>{customer.phone ?? '—'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {customer.platform ? (
                <Badge variant="secondary">{platformLabel(customer.platform)}</Badge>
              ) : null}
              {customer.segments.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className={SEGMENT_BADGE_CLASS[s]}
                >
                  {SEGMENT_LABELS[s]}
                </Badge>
              ))}
            </div>

            {showLedgerSummary ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">{customersT('detail.ledger.title')}</p>
                {ledgerFailed ? (
                  <p className="text-sm text-destructive">
                    {customersT('list.error.ledgerFailed')}
                  </p>
                ) : (
                  <dl className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <ArrowUpRight className="size-3.5 text-amber-500" aria-hidden />
                        {customersT('statement.summary.totalDebit')}
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {ledgerLoading
                          ? '…'
                          : formatTryAmount(ledger?.debit ?? '0')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <ArrowDownLeft className="size-3.5 text-emerald-500" aria-hidden />
                        {customersT('statement.summary.totalCredit')}
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {ledgerLoading
                          ? '…'
                          : formatTryAmount(ledger?.credit ?? '0')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t pt-2">
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <Scale className="size-3.5 text-sky-500" aria-hidden />
                        {customersT('statement.summary.balance')}
                      </dt>
                      <dd
                        className={`font-semibold tabular-nums ${
                          ledgerLoading
                            ? 'text-muted-foreground'
                            : ledgerBalanceClass(ledger?.balance ?? '0')
                        }`}
                      >
                        {ledgerLoading
                          ? '…'
                          : formatTryAmount(ledger?.balance ?? '0')}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            ) : null}

            {showExternalErpNote ? (
              <Alert className="border-sky-200 bg-sky-50/80 text-sky-950">
                <Info className="h-4 w-4 text-sky-600" aria-hidden />
                <AlertTitle className="text-sky-950">
                  {customersT('detail.externalErp.bannerTitle')}
                </AlertTitle>
                <AlertDescription className="text-sky-900/90">
                  <p>{customersT('detail.externalErp.bannerDescription')}</p>
                  <p className="mt-2">
                    <Link
                      to="/connections?tab=erp"
                      className="font-medium text-sky-700 underline-offset-2 hover:underline"
                    >
                      {customersT('detail.externalErp.connectionsLink')}
                    </Link>
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground">Notlar</Label>
                {!editingNotes ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={startEditNotes}
                  >
                    <Pencil className="size-3.5" />
                    Düzenle
                  </Button>
                ) : null}
              </div>
              {editingNotes ? (
                <>
                  <Textarea
                    value={profileNotes}
                    onChange={(e) => setProfileNotes(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={profileNotesMutation.isPending}
                      onClick={() => profileNotesMutation.mutate(profileNotes)}
                    >
                      Kaydet
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingNotes(false)}
                    >
                      İptal
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {customer.notes?.trim() ? customer.notes : 'Henüz not yok.'}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {showNativeInvoice ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => setManualInvoiceOpen(true)}
                >
                  <FileText className="mr-2 size-4" />
                  {t('orders.detail.documents.createInvoice')}
                </Button>
              ) : null}
              <Button
                type="button"
                className="w-full"
                variant={showNativeInvoice ? 'outline' : 'default'}
                onClick={() => navigate('/orders')}
              >
                <ShoppingBag className="mr-2 size-4" />
                Sipariş Oluştur
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="orders">Siparişler</TabsTrigger>
              {showStatementTab ? (
                <TabsTrigger value="statement" className="gap-1.5">
                  <ScrollText className="size-3.5 shrink-0" />
                  {customersT('statement.tab')}
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="analytics">Analitik</TabsTrigger>
              <TabsTrigger value="tags">Etiketler</TabsTrigger>
              <TabsTrigger value="notes">Notlar</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="size-4" />
                    Sipariş geçmişi
                  </CardTitle>
                </CardHeader>
                <CardContent className={customer.orders.length > 0 ? 'p-0' : undefined}>
                  {customer.orders.length === 0 ? (
                    <p className="p-6 text-sm text-muted-foreground">
                      Bu müşteriye ait sipariş bulunamadı.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sipariş no</TableHead>
                          <TableHead>Platform</TableHead>
                          <TableHead>Durum</TableHead>
                          <TableHead>Tarih</TableHead>
                          <TableHead className="text-right">Tutar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customer.orders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell>
                              <Link
                                to={`/orders/${o.id}`}
                                className="font-mono text-sm text-primary hover:underline"
                              >
                                {o.platformOrderId}
                              </Link>
                            </TableCell>
                            <TableCell>{platformLabel(o.platform)}</TableCell>
                            <TableCell>
                              {t(
                                ORDER_STATUS_I18N_KEY[o.status as OrderStatus] ??
                                  'orders.statusUnknown',
                              )}
                            </TableCell>
                            <TableCell>
                              {formatCustomerDate(o.platformCreatedAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatTryAmount(o.totalAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {showStatementTab ? (
              <TabsContent value="statement" className="mt-4">
                {isNativeAccounting ? (
                  <CustomerStatementTab customerId={id} />
                ) : (
                  <EmptyState
                    icon={ScrollText}
                    title={customersT('statement.guard.title')}
                    description={customersT('statement.guard.description')}
                    actionSlot={
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveTab('orders')}
                      >
                        {customersT('statement.guard.backToOrders')}
                      </Button>
                    }
                  />
                )}
              </TabsContent>
            ) : null}

            <TabsContent value="analytics" className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Ortalama sepet
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatTryAmount(customer.averageOrderValue)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Sipariş sıklığı
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium">
                      {orderFrequencyLabel(
                        customer.totalOrders,
                        customer.firstOrderAt,
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Favori platform
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium">
                      {favPlatform ? platformLabel(favPlatform) : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Toplam harcama
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatTryAmount(customer.totalSpent)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="size-4" />
                    Harcama trendi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {spendingTrend.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Grafik için yeterli sipariş verisi yok.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={spendingTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(v) =>
                            `${Number(v).toLocaleString('tr-TR')} ₺`
                          }
                        />
                        <Tooltip
                          formatter={(v) => formatTryAmount(Number(v ?? 0))}
                        />
                        <Bar dataKey="amount" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Platform dağılımı</CardTitle>
                </CardHeader>
                <CardContent>
                  {platformCounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Veri yok.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {platformCounts.map((row) => (
                        <li
                          key={row.platform}
                          className="flex justify-between border-b pb-2 last:border-0"
                        >
                          <span>{row.label}</span>
                          <span className="font-medium tabular-nums">
                            {row.count} sipariş
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tags" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="size-4" />
                    Etiketler
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CustomerTagCombobox
                    tags={customer.tags}
                    suggestions={tagSuggestionsQuery.data ?? []}
                    disabled={tagMutation.isPending}
                    onAdd={(tag) => tagMutation.mutate({ action: 'add', tag })}
                    onRemove={(tag) =>
                      tagMutation.mutate({ action: 'remove', tag })
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <StickyNote className="size-4" />
                    İç notlar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {noteTimeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Henüz zaman çizelgesi notu yok.
                    </p>
                  ) : (
                    <ul className="space-y-3 border-l-2 border-muted pl-4">
                      {noteTimeline.map((entry, idx) => (
                        <li key={`${entry.at}-${idx}`} className="relative">
                          <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-sky-400" />
                          {entry.at ? (
                            <p className="text-xs text-muted-foreground">{entry.at}</p>
                          ) : null}
                          <p className="text-sm">{entry.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="customer-note">Yeni not</Label>
                    <Textarea
                      id="customer-note"
                      placeholder="Müşteri hakkında not ekleyin…"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={3}
                    />
                    <Button
                      disabled={!noteText.trim() || noteMutation.isPending}
                      onClick={() => noteMutation.mutate(noteText.trim())}
                    >
                      Not ekle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </CardContent>
        </Card>
      </div>

      {showNativeInvoice ? (
        <CreateManualInvoiceDialog
          open={manualInvoiceOpen}
          onOpenChange={setManualInvoiceOpen}
          initialCustomer={invoiceCustomerPrefill}
          onCreated={(_invoice) => {
            void queryClient.invalidateQueries({ queryKey: ['customer-statement', id] });
            void queryClient.invalidateQueries({ queryKey: ['customer-ledger-summaries'] });
            void queryClient.invalidateQueries({ queryKey: ['customers'] });
          }}
        />
      ) : null}
    </div>
  );
}
