import { z } from 'zod';

const amount = z.union([
  z.number().finite().nonnegative(),
  z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number).pipe(z.number().finite().nonnegative()),
]);

const balanceResponse = z.object({
  success: z.literal(true),
  data: z.object({
    entreprise: z.string().trim().min(1).max(200),
    balance: amount,
    available_balance: amount,
    currency: z.string().regex(/^[A-Z]{3}$/),
    is_active: z.boolean(),
  }),
});

export type ProviderBalance = {
  provider: 'paym';
  company: string;
  total: number;
  available: number;
  currency: string;
  active: boolean;
  checkedAt: string;
};

export class ProviderBalanceError extends Error {
  constructor(public readonly code: 'authentication' | 'not_found' | 'unavailable' | 'invalid_response') {
    super(code);
    this.name = 'ProviderBalanceError';
  }
}

export async function fetchPaymBalance(input: {
  baseUrl: string;
  getToken: (forceRefresh: boolean) => Promise<string>;
  fetcher?: typeof fetch;
}): Promise<ProviderBalance> {
  const fetcher = input.fetcher ?? fetch;
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      const token = await input.getToken(attempt === 1);
      response = await fetcher(`${input.baseUrl.replace(/\/$/, '')}/api/marchand/balance`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ProviderBalanceError('unavailable');
    }
    if (response.status === 401 && attempt === 0) continue;
    if (response.status === 401) throw new ProviderBalanceError('authentication');
    if (response.status === 404) throw new ProviderBalanceError('not_found');
    if (!response.ok) throw new ProviderBalanceError('unavailable');
    const parsed = balanceResponse.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new ProviderBalanceError('invalid_response');
    return {
      provider: 'paym',
      company: parsed.data.data.entreprise,
      total: parsed.data.data.balance,
      available: parsed.data.data.available_balance,
      currency: parsed.data.data.currency,
      active: parsed.data.data.is_active,
      checkedAt: new Date().toISOString(),
    };
  }
  throw new ProviderBalanceError('authentication');
}
