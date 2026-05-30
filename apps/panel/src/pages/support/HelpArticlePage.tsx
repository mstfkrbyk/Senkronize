import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { MarkdownContent } from '@/components/support/MarkdownContent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import {
  fetchHelpArticle,
  fetchHelpArticles,
  markHelpArticleHelpful,
} from '@/lib/help-api';
import { formatSupportNavContext } from '@/lib/support-nav-context';
import { HELP_CATEGORY_OPTIONS } from '@/types/help';

function helpCategoryLabel(value: string): string {
  return HELP_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

export function HelpArticlePage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [voted, setVoted] = useState<'yes' | 'no' | null>(null);

  const { data: article, isLoading, isError, error } = useQuery({
    queryKey: ['help-article', slug],
    queryFn: () => fetchHelpArticle(slug!),
    enabled: Boolean(slug),
  });

  const navContextLine = formatSupportNavContext(
    groupLabel,
    t('nav.support'),
    article?.title,
  );
  usePageTitle(article?.title ?? t('nav.support'));

  const { data: relatedArticles } = useQuery({
    queryKey: ['help-articles-related', article?.category, slug],
    queryFn: () => fetchHelpArticles({ category: article!.category }),
    enabled: Boolean(article?.category),
  });

  const helpfulMutation = useMutation({
    mutationFn: () => markHelpArticleHelpful(slug!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['help-article', slug] });
      void queryClient.invalidateQueries({ queryKey: ['help-articles'] });
      toast.success('Geri bildiriminiz için teşekkürler');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (!slug) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Geçersiz makale.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !article) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
          <Button type="button" variant="link" className="px-0" asChild>
            <Link to="/support">← Yardım merkezine dön</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const related =
    relatedArticles?.filter((a) => a.slug !== slug).slice(0, 4) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={article.title}
        description={`${helpCategoryLabel(article.category)} · ${article.views} görüntülenme`}
        context={navContextLine}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/support')}>
            <ArrowLeft className="mr-2 size-4" aria-hidden />
            Yardım merkezi
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <MarkdownContent content={article.content} />
        </CardContent>
      </Card>

      {article.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bu makale yardımcı oldu mu?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant={voted === 'yes' ? 'default' : 'outline'}
            disabled={voted !== null || helpfulMutation.isPending}
            onClick={() => {
              setVoted('yes');
              helpfulMutation.mutate();
            }}
          >
            <ThumbsUp className="mr-2 size-4" aria-hidden />
            Evet ({article.helpful})
          </Button>
          <Button
            type="button"
            variant={voted === 'no' ? 'default' : 'outline'}
            disabled={voted !== null}
            onClick={() => setVoted('no')}
          >
            <ThumbsDown className="mr-2 size-4" aria-hidden />
            Hayır
          </Button>
        </CardContent>
      </Card>

      {related.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-semibold">İlgili makaleler</h2>
          <div className="grid gap-2">
            {related.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:border-sky-300 hover:bg-sky-50/50"
                onClick={() => navigate(`/support/help/${item.slug}`)}
              >
                <p className="font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {helpCategoryLabel(item.category)} · {item.views} görüntülenme
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
