import type { MetadataRoute } from 'next';

import { BLOG_POSTS } from '@/lib/blog-data';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://senkronize.com';

  const staticPages = [
    '',
    '/pricing',
    '/features',
    '/faq',
    '/contact',
    '/demo',
    '/blog',
    '/referral',
    '/legal/privacy',
    '/legal/terms',
    '/legal/cancellation',
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.8,
  }));

  const blogPosts = BLOG_POSTS.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...blogPosts];
}
