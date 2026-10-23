import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as currency from '../src/lib/withdrawal-currency.ts';

const require = createRequire(import.meta.url);

test('backend reserves Zelle and PayPal amounts at 142 with fees determined by the source account', async () => {
  const source = fs.readFileSync(new URL('../src/lib/server/withdrawals/withdrawal.service.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  let reserved;
  const db = {
    from: () => ({ select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: { id: 'unit-merchant', has_usd_account: true }, error: null }; } }),
    async rpc(name, args) {
      assert.equal(name, 'prepare_dashboard_withdrawal');
      reserved = args;
      // Stop before creating any withdrawal, sending notifications or calling a provider.
      return { data: { success: false, error: 'UNIT_TEST_STOP' }, error: null };
    },
  };
  const mocks = {
    '@/lib/payment-routing': { createPaymReference: () => 'WTHUNITTEST' },
    '@/utils/supabase/admin': { createAdminClient: () => db },
    '@/lib/server/payments/gateway': { getPaymentProviderConfig: async () => ({ paypal_htg_per_usd: 130 }) },
    '@/lib/server/paym/paym.service': {}, '@/lib/server/bazik/bazik.service': {},
    '@/lib/server/notifications': {}, '@/lib/withdrawal-currency': currency,
    '@/lib/server/payments/paypal': { PayPalService: { getMerchantUsdAccountState: async () => ({ isActive: true }) } },
    '@/lib/server/payments/nowpayments': {}, '@/lib/withdrawal-error-message': {},
    '@/lib/merchant-pricing': { isWithdrawalAmountAllowed: (amount, sourceCurrency, rate) => (sourceCurrency === 'USD' ? amount * rate : amount) <= 75000 },
    '@/lib/review-account': { isReviewAccount: () => false },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  for (const method of ['Zelle', 'PayPal']) {
    for (const sourceCurrency of ['HTG', 'USD']) {
      const amount = sourceCurrency === 'HTG' ? 14200 : 100;
      const result = await module.exports.WithdrawalService.processWithdrawal({
        merchantId: 'unit-merchant', method, sourceCurrency, amount, receiver: 'recipient@example.invalid', requestSource: 'dashboard',
      });
      assert.equal(result.errorCode, 'UNIT_TEST_STOP');
      assert.equal(reserved.p_total, amount);
      assert.equal(reserved.p_source_currency, sourceCurrency);
      assert.equal(reserved.p_payout_currency, 'USD');
      assert.equal(reserved.p_exchange_rate, 142);
      assert.equal(reserved.p_fees, sourceCurrency === 'HTG' ? 0 : 2);
      assert.equal(reserved.p_payout_amount, sourceCurrency === 'HTG' ? 100 : 98);
    }
  }
});
