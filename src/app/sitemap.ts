import { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { route: '', priority: 1, changeFrequency: 'daily' as const },
    { route: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const },
    { route: '/docs/quickstart', priority: 0.95, changeFrequency: 'weekly' as const },
    { route: '/docs/payments', priority: 0.9, changeFrequency: 'weekly' as const },
    { route: '/docs/payment-links', priority: 0.9, changeFrequency: 'weekly' as const },
    { route: '/docs/wordpress-plugin', priority: 0.9, changeFrequency: 'weekly' as const },
    { route: '/docs/authentication', priority: 0.8, changeFrequency: 'weekly' as const },
    { route: '/docs/api-keys', priority: 0.8, changeFrequency: 'weekly' as const },
    { route: '/docs/webhooks', priority: 0.85, changeFrequency: 'weekly' as const },
    { route: '/docs/javascript-sdk', priority: 0.8, changeFrequency: 'weekly' as const },
    { route: '/docs/nodejs-sdk', priority: 0.8, changeFrequency: 'weekly' as const },
    { route: '/docs/php-sdk', priority: 0.8, changeFrequency: 'weekly' as const },
    { route: '/docs/python-sdk', priority: 0.8, changeFrequency: 'weekly' as const },
    { route: '/contact', priority: 0.75, changeFrequency: 'monthly' as const },
    { route: '/terms', priority: 0.5, changeFrequency: 'monthly' as const },
    { route: '/privacy', priority: 0.5, changeFrequency: 'monthly' as const },
  ].map(({ route, priority, changeFrequency }) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
    changeFrequency,
    priority,
  }));

  return [...routes];
}
