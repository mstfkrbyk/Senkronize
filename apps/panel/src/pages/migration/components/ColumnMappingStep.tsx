import type { ReactElement } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MIGRATION_TARGET_FIELDS, type MigrationDataType } from '@/types/migration';

import { FIELD_LABELS, REQUIRED_FIELDS } from '../migration.constants';

interface Props {
  dataType: MigrationDataType;
  sourceHeaders: string[];
  columnMapping: Record<string, string>;
  onMappingChange: (targetField: string, sourceColumn: string) => void;
}

export function ColumnMappingStep({
  dataType,
  sourceHeaders,
  columnMapping,
  onMappingChange,
}: Props): ReactElement {
  const targetFields = MIGRATION_TARGET_FIELDS[dataType];
  const required = new Set(REQUIRED_FIELDS[dataType] ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sütun eşleştirme</CardTitle>
        <CardDescription>
          Dosyadaki sütunları Senkronize alanlarıyla eşleştirin. Zorunlu alanlar kırmızı
          ile işaretlidir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {targetFields.map((targetField) => {
            const isRequired = required.has(targetField);
            const label = FIELD_LABELS[targetField] ?? targetField;
            const value = columnMapping[targetField] ?? '';

            return (
              <div
                key={targetField}
                className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"
              >
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Kaynak: </span>
                  <span className="font-medium">
                    {value || '—'}
                  </span>
                </div>
                <span aria-hidden className="hidden text-center text-muted-foreground sm:block">
                  →
                </span>
                <div className="space-y-1">
                  <Label
                    className={isRequired ? 'text-destructive' : undefined}
                  >
                    {label}
                    {isRequired ? ' *' : ''}
                  </Label>
                  <Select
                    value={value || '__none__'}
                    onValueChange={(v) =>
                      onMappingChange(targetField, v === '__none__' ? '' : v)
                    }
                  >
                    <SelectTrigger
                      className={isRequired && !value ? 'border-destructive' : undefined}
                    >
                      <SelectValue placeholder="Sütun seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Eşleştirme —</SelectItem>
                      {sourceHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
