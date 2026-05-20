import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  tags: string[];
  suggestions: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  disabled?: boolean;
}

export function CustomerTagCombobox({
  tags,
  suggestions,
  onAdd,
  onRemove,
  disabled = false,
}: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const merged = new Set([...suggestions, ...tags]);
    return [...merged].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [suggestions, tags]);

  const trimmed = query.trim();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz etiket yok.</p>
        ) : (
          tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                className="rounded p-0.5 hover:bg-muted"
                aria-label={`${tag} etiketini kaldır`}
                disabled={disabled}
                onClick={() => onRemove(tag)}
              >
                ×
              </button>
            </Badge>
          ))
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between sm:w-72"
            disabled={disabled}
          >
            Etiket ekle…
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Etiket ara veya oluştur…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {trimmed ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-3 text-sm hover:bg-muted"
                    onClick={() => {
                      onAdd(trimmed);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <Plus className="size-4" />
                    &quot;{trimmed}&quot; oluştur
                  </button>
                ) : (
                  'Etiket bulunamadı'
                )}
              </CommandEmpty>
              <CommandGroup>
                {options.map((tag) => (
                  <CommandItem
                    key={tag}
                    value={tag}
                    onSelect={() => {
                      if (tags.includes(tag)) {
                        onRemove(tag);
                      } else {
                        onAdd(tag);
                      }
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        tags.includes(tag) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {tag}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
