'use client';

import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { getPanelUrl } from '@/lib/panel-url';

export function BlogArticleRegisterCta(): ReactElement {
  const panel = getPanelUrl();
  return (
    <Button asChild className="mt-6" size="lg">
      <a
        href={`${panel}/register`}
        onClick={() => {
          track('cta_clicked', { location: 'blog_article_footer', plan: 'trial' });
        }}
      >
        Ücretsiz Deneyin
      </a>
    </Button>
  );
}
