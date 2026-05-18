'use client';

import { useEffect, useRef } from 'react';

import { track } from '@/lib/analytics';

interface Props {
  slug: string;
  readMinutes: number;
}

/** Blog yazısı açıldığında okuma olayı (bir kez). */
export function BlogPostReadTracker({ slug, readMinutes }: Props): null {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) {
      return;
    }
    fired.current = true;
    track('blog_post_read', { slug, readTime: readMinutes });
  }, [slug, readMinutes]);

  return null;
}
