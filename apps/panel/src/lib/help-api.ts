import { api } from '@/lib/api';
import type { HelpArticleDetail, HelpArticleListItem } from '@/types/help';

export async function fetchHelpArticles(params?: {
  category?: string;
  search?: string;
}): Promise<HelpArticleListItem[]> {
  const { data } = await api.get<{ data: HelpArticleListItem[] }>(
    '/help/articles',
    { params },
  );
  return data.data;
}

export async function fetchHelpArticle(slug: string): Promise<HelpArticleDetail> {
  const { data } = await api.get<{ data: HelpArticleDetail }>(
    `/help/articles/${slug}`,
  );
  return data.data;
}

export async function markHelpArticleHelpful(
  slug: string,
): Promise<{ helpful: number }> {
  const { data } = await api.patch<{ data: { helpful: number } }>(
    `/help/articles/${slug}/helpful`,
  );
  return data.data;
}
