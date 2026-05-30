import type { DragEvent, ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import { toast } from 'sonner';

interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  children: CategoryTreeNode[];
}

interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  platformMappings: {
    id: string;
    platform: string;
    platformCategoryId: string;
    platformCategoryName: string;
  }[];
  products: {
    id: string;
    barcode: string;
    name: string;
    sku: string | null;
    isActive: boolean;
  }[];
}

const COMMON_PLATFORMS = [
  'TRENDYOL',
  'HEPSIBURADA',
  'N11',
  'AMAZON_TR',
  'CICEKSEPETI',
  'PTTAVM',
  'PAZARAMA',
  'TICIMAX',
  'TSOFT',
  'SHOPIFY',
  'WOOCOMMERCE',
] as const;

interface TreeRowProps {
  node: CategoryTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent, id: string) => void;
}

function TreeRow({
  node,
  depth,
  selectedId,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: TreeRowProps): ReactElement {
  const active = selectedId === node.id;
  return (
    <div className="select-none">
      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, node.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
        onClick={() => onSelect(node.id)}
        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
          active
            ? 'border-sky-400 bg-sky-50 text-slate-900'
            : 'border-transparent hover:bg-slate-100'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <GripVertical className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="truncate font-medium">{node.name}</span>
        {!node.isActive ? (
          <span className="text-muted-foreground shrink-0 text-xs">(pasif)</span>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <div className="mt-1 space-y-1">
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function findNode(
  nodes: CategoryTreeNode[],
  id: string,
): CategoryTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) {
      return n;
    }
    const c = findNode(n.children, id);
    if (c) {
      return c;
    }
  }
  return null;
}

export function CategoriesPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.categories'));

  usePageTitle('Kategoriler');
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formParentId, setFormParentId] = useState<string | null>(null);

  const [mapOpen, setMapOpen] = useState(false);
  const [mapPlatform, setMapPlatform] = useState<string>('TRENDYOL');
  const [mapExtId, setMapExtId] = useState('');
  const [mapExtName, setMapExtName] = useState('');

  const treeQuery = useQuery({
    queryKey: ['categories', 'tree'] as const,
    queryFn: async () => {
      const { data } = await api.get<CategoryTreeNode[]>('/categories/tree');
      return data;
    },
  });

  const detailQuery = useQuery({
    queryKey: ['categories', 'detail', selectedId] as const,
    queryFn: async () => {
      if (!selectedId) {
        return null;
      }
      const { data } = await api.get<CategoryDetail>(`/categories/${selectedId}`);
      return data;
    },
    enabled: Boolean(selectedId),
  });

  const flatForParentSelect = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    const walk = (nodes: CategoryTreeNode[], depth: number): void => {
      for (const n of nodes) {
        rows.push({ id: n.id, label: `${'— '.repeat(depth)}${n.name}` });
        walk(n.children, depth + 1);
      }
    };
    if (treeQuery.data) {
      walk(treeQuery.data, 0);
    }
    return rows;
  }, [treeQuery.data]);

  const invalidate = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['categories'] });
  }, [qc]);

  const createMut = useMutation({
    mutationFn: async (body: { name: string; parentId: string | null }) => {
      await api.post('/categories', body);
    },
    onSuccess: async () => {
      toast.success('Kategori oluşturuldu');
      setModalOpen(false);
      setFormName('');
      setFormParentId(null);
      await invalidate();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: async (payload: {
      id: string;
      name?: string;
      parentId?: string | null;
      sortOrder?: number;
    }) => {
      const { id, ...rest } = payload;
      await api.patch(`/categories/${id}`, rest);
    },
    onSuccess: async () => {
      toast.success('Kategori güncellendi');
      setModalOpen(false);
      setEditingId(null);
      await invalidate();
      if (selectedId) {
        await qc.invalidateQueries({ queryKey: ['categories', 'detail', selectedId] });
      }
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const swapOrderMut = useMutation({
    mutationFn: async (payload: { idA: string; soA: number; idB: string; soB: number }) => {
      await api.patch(`/categories/${payload.idA}`, { sortOrder: payload.soB });
      await api.patch(`/categories/${payload.idB}`, { sortOrder: payload.soA });
    },
    onSuccess: async () => {
      toast.success('Sıra güncellendi');
      await invalidate();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: async () => {
      toast.success('Kategori silindi');
      setSelectedId(null);
      await invalidate();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const mapMut = useMutation({
    mutationFn: async () => {
      if (!selectedId) {
        return;
      }
      await api.post(`/categories/${selectedId}/platform-mapping`, {
        platform: mapPlatform,
        platformCategoryId: mapExtId.trim(),
        platformCategoryName: mapExtName.trim(),
      });
    },
    onSuccess: async () => {
      toast.success('Platform eşlemesi kaydedildi');
      setMapOpen(false);
      setMapExtId('');
      setMapExtName('');
      if (selectedId) {
        await qc.invalidateQueries({ queryKey: ['categories', 'detail', selectedId] });
      }
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const openCreate = (): void => {
    setEditingId(null);
    setFormName('');
    setFormParentId(selectedId);
    setModalOpen(true);
  };

  const openEdit = (): void => {
    const d = detailQuery.data;
    if (!d) {
      return;
    }
    setEditingId(d.id);
    setFormName(d.name);
    setFormParentId(d.parentId);
    setModalOpen(true);
  };

  const handleSaveModal = (): void => {
    const name = formName.trim();
    if (name.length < 1) {
      toast.error('Kategori adı gerekli');
      return;
    }
    if (editingId) {
      updateMut.mutate({ id: editingId, name, parentId: formParentId });
    } else {
      createMut.mutate({ name, parentId: formParentId });
    }
  };

  const onDragStart = (e: DragEvent, id: string): void => {
    setDragId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: DragEvent): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: DragEvent, targetId: string): void => {
    e.preventDefault();
    const fromId = dragId ?? e.dataTransfer.getData('text/plain');
    setDragId(null);
    if (!fromId || fromId === targetId || !treeQuery.data) {
      return;
    }
    const a = findNode(treeQuery.data, fromId);
    const b = findNode(treeQuery.data, targetId);
    if (!a || !b || a.parentId !== b.parentId) {
      toast.message('Yalnızca aynı seviyedeki kategoriler sıralanabilir');
      return;
    }
    const soA = a.sortOrder;
    const soB = b.sortOrder;
    swapOrderMut.mutate({ idA: a.id, soA, idB: b.id, soB });
  };

  const tree = treeQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategoriler"
        description="Ürün kategorisi eşlemelerini yönetin."
        context={navContextLine}
        actions={
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            Kategori Ekle
          </Button>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ağaç</CardTitle>
            <CardDescription>
              Sürükleyip bırakarak aynı düzeyde sıralama (sortOrder değişimi)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {treeQuery.isLoading ? (
              <TableSkeleton rows={6} cols={1} />
            ) : treeQuery.isError ? (
              <EmptyState
                title="Yüklenemedi"
                description={getApiErrorMessage(treeQuery.error)}
              />
            ) : tree.length === 0 ? (
              <EmptyState
                title="Henüz kategori yok"
                description="Yeni kategori ekleyerek başlayın"
              />
            ) : (
              <div className="max-h-[60vh] space-y-1 overflow-auto pr-1">
                {tree.map((n) => (
                  <TreeRow
                    key={n.id}
                    node={n}
                    depth={0}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2">
            <div>
              <CardTitle className="text-base">
                {detailQuery.data?.name ?? 'Kategori seçin'}
              </CardTitle>
              <CardDescription>
                Ürünler ve platform kategori eşlemeleri
              </CardDescription>
            </div>
            {selectedId && detailQuery.data ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="mr-2 size-4" />
                  Düzenle
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMapOpen(true)}
                >
                  Platform Eşlemesi
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Bu kategori ve alt kategoriler silinsin mi?')) {
                      deleteMut.mutate(selectedId);
                    }
                  }}
                >
                  <Trash2 className="mr-2 size-4" />
                  Sil
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedId ? (
              <p className="text-muted-foreground text-sm">Sol taraftan kategori seçin.</p>
            ) : detailQuery.isLoading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : detailQuery.isError ? (
              <EmptyState
                title="Detay yüklenemedi"
                description={getApiErrorMessage(detailQuery.error)}
              />
            ) : detailQuery.data ? (
              <>
                <div>
                  <h3 className="mb-2 text-sm font-medium">Platform eşlemeleri</h3>
                  {detailQuery.data.platformMappings.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Henüz eşleme yok.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Platform</TableHead>
                          <TableHead>Harici ID</TableHead>
                          <TableHead>Harici ad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailQuery.data.platformMappings.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>
                              {getMarketplaceBranding(m.platform).label}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {m.platformCategoryId}
                            </TableCell>
                            <TableCell>{m.platformCategoryName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium">Bu kategorideki ürünler</h3>
                  {detailQuery.data.products.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Bu kategoriye atanmış ürün yok.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Barkod</TableHead>
                          <TableHead>Ad</TableHead>
                          <TableHead>SKU</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailQuery.data.products.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.barcode}</TableCell>
                            <TableCell>{p.name}</TableCell>
                            <TableCell>{p.sku ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Kategori düzenle' : 'Yeni kategori'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Ad</Label>
              <Input
                id="cat-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Örn. Elektronik"
              />
            </div>
            <div className="space-y-2">
              <Label>Üst kategori</Label>
              <Select
                value={formParentId ?? '__root__'}
                onValueChange={(v) => setFormParentId(v === '__root__' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kök düzey" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">Kök düzey</SelectItem>
                  {flatForParentSelect
                    .filter((r) => r.id !== editingId)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              onClick={handleSaveModal}
              disabled={createMut.isPending || updateMut.isPending}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Platform kategori eşlemesi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={mapPlatform} onValueChange={setMapPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {getMarketplaceBranding(p).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="map-ext-id">Platform kategori ID</Label>
              <Input
                id="map-ext-id"
                value={mapExtId}
                onChange={(e) => setMapExtId(e.target.value)}
                placeholder="Pazaryerindeki kategori kodu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="map-ext-name">Platform kategori adı</Label>
              <Input
                id="map-ext-name"
                value={mapExtName}
                onChange={(e) => setMapExtName(e.target.value)}
                placeholder="Görünen ad"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMapOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              onClick={() => mapMut.mutate()}
              disabled={mapMut.isPending || !mapExtId.trim() || !mapExtName.trim()}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
