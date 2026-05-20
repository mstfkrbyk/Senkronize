import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { MarkdownContent } from '@/components/support/MarkdownContent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api';
import {
  fetchHelpArticle,
  fetchHelpArticles,
  markHelpArticleHelpful,
} from '@/lib/help-api';
import { HELP_CATEGORY_OPTIONS } from '@/types/help';

function helpCategoryLabel(value: string): string {
  return HELP_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

export function HelpArticlePage(): ReactElement {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [voted, setVoted] = useState<'yes' | 'no' | null>(null);

  const { data: article, isLoading, isError, error } = useQuery({
    queryKey: ['help-article', slug],
    queryFn: () => fetchHelpArticle(slug!),
    enabled: Boolean(slug),
  });

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
    return <p className="p-6 text-sm text-muted-foreground">Geçersiz makale.</p>;
  }

  if (isLoading) {
    return <Skeleton className="m-6 h-96 w-full max-w-3xl" />;
  }

  if (isError || !article) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
        <Button type="button" variant="link" className="mt-2 px-0" asChild>
          <Link to="/support">← Yardım merkezine dön</Link>
        </Button>
      </div>
    );
  }

  const related =
    relatedArticles?.filter((a) => a.slug !== slug).slice(0, 4) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-6">
      <Button
        type="button"
        variant="ghost"
        className="w-fit px-0"
        onClick={() => navigate('/support')}
      >
        <ArrowLeft className="mr-2 size-4" aria-hidden />
        Yardım merkezi
      </Button>

      <div>
        <Badge variant="secondary" className="mb-2">
          {helpCategoryLabel(article.category)}
        </Badge>
        <h1 className="text-2xl font-semibold">{article.title}</h1>
        <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          <Eye className="size-4" aria-hidden />
          {article.views} görüntülenme
        </p>
      </div>

      <MarkdownContent
        content={article.content}
        className="rounded-lg border bg-card p-6"
      />

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
