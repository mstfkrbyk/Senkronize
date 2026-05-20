import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation } from '@tanstack/react-query';
import {
  GripVertical,
  Link2,
  Loader2,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { ProductImage } from '@/components/ProductImage';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  productId: string;
  imageUrls: string[];
  onChanged: () => void;
}

interface ImageItem {
  id: string;
  url: string;
}

function toImageItems(urls: string[]): ImageItem[] {
  return urls.map((url, index) => ({ id: String(index), url }));
}

function SortableImageCard({
  item,
  isPrimary,
  onSetPrimary,
  onDelete,
}: {
  item: ImageItem;
  isPrimary: boolean;
  onSetPrimary: () => void;
  onDelete: () => void;
}): ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-white',
        isDragging && 'z-10 opacity-70 shadow-lg',
      )}
    >
      <button
        type="button"
        className="text-muted-foreground absolute left-1 top-1 z-10 cursor-grab rounded bg-white/90 p-0.5 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      {isPrimary ? (
        <span className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
          <Star className="size-3 fill-amber-500 text-amber-500" />
          Ana
        </span>
      ) : null}
      <ProductImage src={item.url} alt="" className="aspect-square w-full object-cover" />
      <div className="absolute bottom-0 flex w-full gap-1 bg-black/50 p-1">
        {!isPrimary ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 text-white hover:bg-white/20"
            title="Ana görsel yap"
            onClick={onSetPrimary}
          >
            <Star className="size-3" />
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-white hover:bg-white/20"
          title="Sil"
          onClick={onDelete}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

export function ImageManager({
  productId,
  imageUrls,
  onChanged,
}: Props): ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ImageItem[]>(() => toImageItems(imageUrls));
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    setItems(toImageItems(imageUrls));
  }, [imageUrls]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const reorderMutation = useMutation({
    mutationFn: async (nextUrls: string[]) => {
      await api.post(`/products/${productId}/images/reorder`, {
        imageUrls: nextUrls,
      });
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
      setDeleteIndex(null);
      onChanged();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const addUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const next = [...imageUrls, url.trim()];
      await api.post(`/products/${productId}/images/reorder`, {
        imageUrls: next,
      });
    },
    onSuccess: () => {
      toast.success('Görsel URL eklendi');
      setUrlInput('');
      setUrlDialogOpen(false);
      onChanged();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const uploadFiles = async (files: FileList): Promise<void> => {
    const fileArray = Array.from(files);
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (!file) {
        continue;
      }
      setUploadProgress(Math.round((i / fileArray.length) * 100));
      const body = new FormData();
      body.append('file', file);
      try {
        await api.post(`/products/${productId}/image`, body, {
          onUploadProgress: (evt) => {
            if (evt.total) {
              const filePct = Math.round((evt.loaded / evt.total) * 100);
              const overall = Math.round(
                ((i + filePct / 100) / fileArray.length) * 100,
              );
              setUploadProgress(overall);
            }
          },
        });
      } catch (e) {
        toast.error(getApiErrorMessage(e));
        setUploadProgress(null);
        return;
      }
    }
    setUploadProgress(100);
    toast.success(`${fileArray.length} görsel yüklendi`);
    setUploadProgress(null);
    onChanged();
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = items.findIndex((x) => x.id === active.id);
    const newIndex = items.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    reorderMutation.mutate(reordered.map((x) => x.url));
  };

  const setPrimary = (index: number): void => {
    if (index === 0) {
      return;
    }
    const next = [...items];
    const [picked] = next.splice(index, 1);
    if (!picked) {
      return;
    }
    next.unshift(picked);
    setItems(next);
    reorderMutation.mutate(next.map((x) => x.url));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Görseller</CardTitle>
          <CardDescription>
            Sürükleyerek sıralayın, ana görseli seçin veya yükleyin
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="outline">
                <Link2 className="mr-2 size-4" />
                URL ile ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>URL ile görsel ekle</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2 py-2">
                <Label htmlFor="image-url">Görsel URL</Label>
                <Input
                  id="image-url"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                  }}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  disabled={!urlInput.trim() || addUrlMutation.isPending}
                  onClick={() => {
                    addUrlMutation.mutate(urlInput);
                  }}
                >
                  Ekle
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) {
                void uploadFiles(files);
                e.target.value = '';
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploadProgress !== null}
            onClick={() => fileRef.current?.click()}
          >
            {uploadProgress !== null ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            Görsel yükle
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {uploadProgress !== null ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Yükleniyor…</span>
              <span className="tabular-nums">%{uploadProgress}</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz görsel yok.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((x) => x.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((item, index) => (
                  <SortableImageCard
                    key={`${item.url}-${item.id}`}
                    item={item}
                    isPrimary={index === 0}
                    onSetPrimary={() => {
                      setPrimary(index);
                    }}
                    onDelete={() => {
                      setDeleteIndex(index);
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      <AlertDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteIndex(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Görseli sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu görseli silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteIndex !== null) {
                  deleteMutation.mutate(deleteIndex);
                }
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
