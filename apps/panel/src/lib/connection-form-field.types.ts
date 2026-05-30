/**
 * Pazaryeri / ERP bağlantı formları için kimlik alanı tanımları.
 */

export interface ConnectionFormFieldOption {
  value: string;
  label: string;
}

export interface ConnectionFormFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'password' | 'url' | 'number' | 'select';
  required: boolean;
  hint?: string;
  defaultValue?: string;
  options?: ConnectionFormFieldOption[];
}

export interface ConnectionPlatformMeta {
  helpText?: string;
  docsUrl?: string;
}
