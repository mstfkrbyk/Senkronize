import type { ReactElement } from 'react';
import type { ControllerRenderProps } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConnectionFormFieldDef } from '@/lib/connection-form-field.types';
import { cn } from '@/lib/utils';

interface ConnectionCredentialFieldProps {
  field: ConnectionFormFieldDef;
  rhf: ControllerRenderProps<Record<string, string>, string>;
  hasError?: boolean;
  passwordVisible?: boolean;
  onValueChange?: () => void;
}

export function ConnectionCredentialField({
  field,
  rhf,
  hasError,
  passwordVisible,
  onValueChange,
}: ConnectionCredentialFieldProps): ReactElement {
  const inputClassName = cn(hasError && 'border-destructive');

  if (field.type === 'select' && field.options && field.options.length > 0) {
    return (
      <Select
        value={rhf.value || field.defaultValue || field.options[0]?.value}
        onValueChange={(value) => {
          rhf.onChange(value);
          onValueChange?.();
        }}
      >
        <SelectTrigger className={inputClassName} aria-invalid={hasError}>
          <SelectValue placeholder={field.placeholder ?? 'Seçin'} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      {...rhf}
      type={
        field.type === 'password'
          ? passwordVisible
            ? 'text'
            : 'password'
          : field.type === 'number'
            ? 'number'
            : 'text'
      }
      autoComplete="off"
      placeholder={
        field.placeholder ??
        (field.type === 'number' && field.defaultValue !== undefined
          ? `Örn. ${field.defaultValue}`
          : field.type === 'url'
            ? 'https:// veya http:// ile başlayın'
            : undefined)
      }
      aria-invalid={hasError}
      className={inputClassName}
      onChange={(e) => {
        rhf.onChange(e);
        onValueChange?.();
      }}
    />
  );
}
