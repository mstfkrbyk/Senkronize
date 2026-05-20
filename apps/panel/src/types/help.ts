export interface HelpArticleListItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  views: number;
  helpful: number;
  createdAt: string;
  updatedAt: string;
}

export interface HelpArticleDetail extends HelpArticleListItem {
  content: string;
}

export type HelpCategory = 'teknik' | 'entegrasyon' | 'fatura' | 'genel';

export const HELP_CATEGORY_OPTIONS: {
  value: HelpCategory;
  label: string;
  description: string;
}[] = [
  {
    value: 'teknik',
    label: 'Teknik',
    description: 'Hata, performans ve sistem sorunları',
  },
  {
    value: 'entegrasyon',
    label: 'Entegrasyon',
    description: 'Pazaryeri ve ERP bağlantıları',
  },
  {
    value: 'fatura',
    label: 'Fatura',
    description: 'Abonelik, ödeme ve faturalandırma',
  },
  {
    value: 'genel',
    label: 'Genel',
    description: 'Başlangıç rehberleri ve SSS',
  },
];
