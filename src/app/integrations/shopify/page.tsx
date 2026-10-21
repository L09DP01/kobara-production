import { redirect } from 'next/navigation';

export default async function ShopifyLocalRedirect({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const query = new URLSearchParams();
  if (typeof values.hmac === 'string' || typeof values.shop === 'string') {
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string') query.set(key, value);
      else if (Array.isArray(value)) for (const item of value) query.append(key, item);
    }
    redirect(`/api/integrations/shopify/install?${query}`);
  }
  for (const key of ['connected', 'disconnected', 'error', 'rate_saved', 'link_account']) {
    if (typeof values[key] === 'string') query.set(key, values[key]);
  }
  redirect(`/dashboard/integrations/shopify${query.size ? `?${query}` : ''}`);
}
