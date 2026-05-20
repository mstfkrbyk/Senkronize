import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ClipboardList,
  LineChart,
  Loader2,
  MessageSquare,
  Plus,
  Store,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { PO_STATUS_LABEL_TR, poStatusBadgeClass } from '@/lib/po-status';
import { StarRating } from '@/pages/suppliers/components/StarRating';
import {
  buildSpendTrendFromOrders,
  formatSupplierDate,
  formatTryAmount,
  parseSupplierRating,
  supplierContactLine,
} from '@/pages/suppliers/supplier-utils';
import type { SupplierContactDto, SupplierDto, SupplierPerformanceDto } from '@/types/supply';

const CONTACT_METHODS = [
  { value: 'E-posta', label: 'E-posta' },
  { value: 'Telefon', label: 'Telefon' },
  { value: 'Toplantı', label: 'Toplantı' },
  { value: 'Diğer', label: 'Diğer' },
] as const;

export function SupplierDetailPage(): ReactElement {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const supplierId = id ?? '';
  const queryClient = useQueryClient();
  const [contactSubject, setContactSubject] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [contactMethod, setContactMethod] = useState('E-posta');

  const supplierQuery = useQuery({
    queryKey: ['supplier', supplierId],
    enabled: supplierId.length > 0,
    queryFn: async (): Promise<SupplierDto> => {
      const { data } = await api.get<{ data: SupplierDto }>(`/suppliers/${supplierId}`);
      return data.data;
    },
  });

  const performanceQuery = useQuery({
    queryKey: ['supplier-performance', supplierId],
    enabled: supplierId.length > 0,
    queryFn: async (): Promise<SupplierPerformanceDto> => {
      const { data } = await api.get<{ data: SupplierPerformanceDto }>(
        `/suppliers/${supplierId}/performance`,
      );
      return data.data;
    },
  });

  const contactMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post(`/suppliers/${supplierId}/contact`, {
        subject: contactSubject.trim() || undefined,
        notes: contactNotes.trim(),
        contactMethod,
      });
    },
    onSuccess: async () => {
      toast.success('İletişim kaydı eklendi.');
      setContactSubject('');
      setContactNotes('');
      await queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  usePageTitle(supplierQuery.data?.name ?? 'Tedarikçi');

  const spendTrend = useMemo(
    () => buildSpendTrendFromOrders(performanceQuery.data?.orderHistory ?? []),
    [performanceQuery.data?.orderHistory],
  );

  const ratingTrend = useMemo(() => {
    const history = performanceQuery.data?.orderHistory ?? [];
    const received = history.filter((o) => o.status === 'RECEIVED' && o.receivedAt);
    return received.slice(0, 8).reverse().map((o, i) => ({
      label: o.orderNumber.slice(-6),
      score: Math.max(1, 5 - i * 0.3),
    }));
  }, [performanceQuery.data?.orderHistory]);

  if (!supplierId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Store}
          title="Geçersiz bağlantı"
          description="Tedarikçi seçilemedi."
        />
      </div>
    );
  }

  if (supplierQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (supplierQuery.isError || !supplierQuery.data) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Store}
          title="Tedarikçi bulunamadı"
          description={getApiErrorMessage(supplierQuery.error)}
        />
      </div>
    );
  }

  const s = supplierQuery.data;
  const perf = performanceQuery.data;
  const contacts = s.contacts ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/suppliers">
            <ArrowLeft className="mr-1 size-4" />
            Listeye dön
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void navigate(`/purchase-orders?supplierId=${supplierId}&create=1`);
          }}
        >
          <Plus className="mr-1 size-4" />
          Yeni sipariş oluştur
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">{s.name}</CardTitle>
            {!s.isActive ? (
              <Badge variant="outline">Pasif</Badge>
            ) : (
              <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-800">
                Aktif
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">İletişim</p>
              <p>{supplierContactLine(s)}</p>
              {s.contactName ? <p className="text-muted-foreground">{s.contactName}</p> : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ülke</p>
              <p>{s.country ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vergi no</p>
              <p>{s.taxNumber ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ödeme koşulları</p>
              <p>{s.paymentTerms ?? '—'}</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Para birimi</p>
                <p>{s.currency}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tedarik süresi</p>
                <p>{s.leadTimeDays != null ? `${s.leadTimeDays} gün` : '—'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Puan</p>
              <StarRating
                value={parseSupplierRating(s.rating) ?? perf?.rating ?? null}
                size="md"
              />
            </div>
            {s.address ? (
              <div>
                <p className="text-xs text-muted-foreground">Adres</p>
                <p className="whitespace-pre-wrap">{s.address}</p>
              </div>
            ) : null}
            {perf ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Toplam harcama</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatTryAmount(perf.totalSpend)}
                </p>
                <p className="text-xs text-muted-foreground">{perf.orderCount} sipariş</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="min-w-0">
          <Tabs defaultValue="orders">
            <TabsList className="mb-4 w-full justify-start">
              <TabsTrigger value="orders">
                <ClipboardList className="mr-1.5 size-4" />
                Siparişler
              </TabsTrigger>
              <TabsTrigger value="performance">
                <LineChart className="mr-1.5 size-4" />
                Performans
              </TabsTrigger>
              <TabsTrigger value="contacts">
                <MessageSquare className="mr-1.5 size-4" />
                İletişim geçmişi
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-0">
              {performanceQuery.isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : !perf?.orderHistory.length ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Henüz sipariş yok"
                  description="Bu tedarikçi için satın alma siparişi oluşturabilirsiniz."
                  action={{
                    label: 'Yeni sipariş',
                    onClick: () => {
                      void navigate(`/purchase-orders?supplierId=${supplierId}&create=1`);
                    },
                  }}
                />
              ) : (
                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sipariş no</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="text-right">Tutar</TableHead>
                        <TableHead>Tarih</TableHead>
                        <TableHead className="w-[90px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perf.orderHistory.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono text-sm">{po.orderNumber}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={poStatusBadgeClass(po.status)}
                            >
                              {PO_STATUS_LABEL_TR[po.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {po.totalAmount} {po.currency}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatSupplierDate(po.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Button type="button" variant="link" className="px-0" asChild>
                              <Link to={`/purchase-orders/${po.id}`}>Detay</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="performance" className="mt-0 space-y-4">
              {performanceQuery.isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                          Ort. teslimat süresi
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-2xl font-semibold tabular-nums">
                        {perf?.avgDeliveryDays != null
                          ? `${perf.avgDeliveryDays} gün`
                          : '—'}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                          Güncel puan
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <StarRating
                          value={perf?.rating ?? parseSupplierRating(s.rating)}
                          size="md"
                        />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                          Toplam harcama
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-2xl font-semibold tabular-nums">
                        {formatTryAmount(perf?.totalSpend)}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Puan trendi</CardTitle>
                    </CardHeader>
                    <CardContent className="h-56">
                      {ratingTrend.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Teslim alınan sipariş yok; puan grafiği henüz oluşmadı.
                        </p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <ReLineChart data={ratingTrend}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="score"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot
                            />
                          </ReLineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Harcama trendi</CardTitle>
                    </CardHeader>
                    <CardContent className="h-56">
                      {spendTrend.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Henüz harcama verisi yok.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={spendTrend}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                              formatter={(v) => formatTryAmount(Number(v ?? 0))}
                            />
                            <Bar
                              dataKey="amount"
                              fill="hsl(199 89% 48%)"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="contacts" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Yeni kayıt</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Konu</Label>
                      <Input
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        placeholder="Örn. Fiyat görüşmesi"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Yöntem</Label>
                      <Select value={contactMethod} onValueChange={setContactMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTACT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Not *</Label>
                    <Textarea
                      rows={3}
                      value={contactNotes}
                      onChange={(e) => setContactNotes(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={!contactNotes.trim() || contactMutation.isPending}
                    onClick={() => contactMutation.mutate()}
                  >
                    Kaydet
                  </Button>
                </CardContent>
              </Card>

              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz iletişim kaydı yok.</p>
              ) : (
                <ul className="space-y-3">
                  {contacts.map((c: SupplierContactDto) => (
                    <li key={c.id} className="rounded-lg border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{c.subject ?? 'Görüşme'}</span>
                        <span className="text-muted-foreground">
                          {new Date(c.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      {c.contactMethod ? (
                        <Badge variant="secondary" className="mt-1">
                          {c.contactMethod}
                        </Badge>
                      ) : null}
                      <p className="mt-2 whitespace-pre-wrap text-sm">{c.notes}</p>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
