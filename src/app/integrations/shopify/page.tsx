import { redirect } from 'next/navigation';

export default async function ShopifyLocalRedirect({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['connected', 'disconnected', 'error']) {
    if (typeof values[key] === 'string') query.set(key, values[key]);
  }
  redirect(`/dashboard/integrations/shopify${query.size ? `?${query}` : ''}`);
}
