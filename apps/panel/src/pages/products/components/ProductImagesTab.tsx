import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { GripVertical, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ProductImage } from '@/components/ProductImage';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api, getApiErrorMessage } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';

interface Props {
  productId: string;
  imageUrls: string[];
  onChanged: () => void;
}

const PLATFORM_PREVIEWS = MARKETPLACE_OPTIONS.slice(0, 4).map((p) => ({
  id: p.id,
  label: p.label,
  aspect: p.id === 'TRENDYOL' ? '1/1' : '4/5',
}));

export function ProductImagesTab({
  productId,
  imageUrls,
  onChanged,
}: Props): ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>(imageUrls);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState(
    PLATFORM_PREVIEWS[0]?.id ?? 'TRENDYOL',
  );

  useEffect(() => {
    setUrls(imageUrls);
  }, [imageUrls]);

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append('file', file);
        await api.post(`/products/${productId}/image`, body);
      }
    },
    onSuccess: () => {
      toast.success('Görseller yüklendi');
      onChanged();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (next: string[]) => {
      await api.post(`/products/${productId}/images/reorder`, { imageUrls: next });
    },
    onSuccess: () => {
      onChanged();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (index: number) => {
      await api.delete(`/products/${productId}/images/${index}`);
    },
    onSuccess: () => {
      toast.success('Görsel silindi');
      onChanged();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const setPrimary = (index: number): void => {
    if (index === 0) {
      return;
    }
    const next = [...urls];
    const [picked] = next.splice(index, 1);
    if (!picked) {
      return;
    }
    next.unshift(picked);
    setUrls(next);
    reorderMutation.mutate(next);
  };

  const onDropReorder = (targetIndex: number): void => {
    if (dragIndex === null || dragIndex === targetIndex) {
      return;
    }
    const next = [...urls];
    const [moved] = next.splice(dragIndex, 1);
    if (!moved) {
      return;
    }
    next.splice(targetIndex, 0, moved);
    setUrls(next);
    setDragIndex(null);
    reorderMutation.mutate(next);
  };

  const primaryUrl = urls[0];
  const previewMeta = PLATFORM_PREVIEWS.find((p) => p.id === previewPlatform);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Görseller</CardTitle>
          <CardDescription>
            Sürükleyerek sıralayın, ana görseli seçin veya çoklu yükleyin
          </CardDescription>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) {
                uploadMutation.mutate(files);
                e.target.value = '';
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploadMutation.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            Görsel yükle
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {urls.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz görsel yok.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {urls.map((url, index) => (
              <div
                key={`${url}-${index}`}
                draggable
                onDragStart={() => { setDragIndex(index); }}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => { onDropReorder(index); }}
                className={`group relative overflow-hidden rounded-lg border bg-white ${
                  dragIndex === index ? 'opacity-60' : ''
                }`}
              >
                <div className="text-muted-foreground absolute left-1 top-1 z-10 rounded bg-white/80 p-0.5">
                  <GripVertical className="size-4" />
                </div>
                {index === 0 ? (
                  <span className="absolute right-1 top-1 z-10 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                    Ana
                  </span>
                ) : null}
                <ProductImage src={url} alt="" className="aspect-square w-full object-cover" />
                <div className="absolute bottom-0 flex w-full gap-1 bg-black/50 p-1">
                  {index !== 0 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-white hover:bg-white/20"
                      onClick={() => { setPrimary(index); }}
                    >
                      <Star className="size-3" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 text-white hover:bg-white/20"
                    onClick={() => {
                      deleteMutation.mutate(index);
                    }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {primaryUrl ? (
          <div className="rounded-lg border p-4">
            <p className="mb-3 text-sm font-medium">Platform önizleme</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {PLATFORM_PREVIEWS.map((p) => {
                const branding = getMarketplaceBranding(p.id);
                return (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={previewPlatform === p.id ? 'default' : 'outline'}
                    onClick={() => { setPreviewPlatform(p.id); }}
                  >
                    {branding.logo} {p.label}
                  </Button>
                );
              })}
            </div>
            <div
              className="mx-auto max-w-[200px] overflow-hidden rounded-md border bg-slate-50"
              style={{ aspectRatio: previewMeta?.aspect ?? '1/1' }}
            >
              <ProductImage
                src={primaryUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <p className="text-muted-foreground mt-2 text-center text-xs">
              {previewMeta?.label} — {previewMeta?.aspect} oran
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
