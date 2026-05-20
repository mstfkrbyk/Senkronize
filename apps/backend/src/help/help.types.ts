export interface HelpArticleListItemDto {
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

export interface HelpArticleDetailDto extends HelpArticleListItemDto {
  content: string;
}
