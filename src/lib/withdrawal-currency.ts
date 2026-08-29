export type WithdrawalCurrency = 'HTG' | 'USD';

export interface WithdrawalQuote {
  sourceCurrency: WithdrawalCurrency;
  payoutCurrency: WithdrawalCurrency;
  grossAmount: number;
  feeRate: number;
  fees: number;
  netSourceAmount: number;
  exchangeRate: number;
  payoutAmount: number;
}

export function resolveWithdrawalPayoutCurrency(method: string): WithdrawalCurrency {
  const normalizedMethod = String(method || '').trim().toLowerCase();
  return normalizedMethod === 'zelle' || normalizedMethod === 'paypal' ? 'USD' : 'HTG';
}

export function calculateWithdrawalQuote(params: {
  amount: number;
  method: string;
  sourceCurrency: WithdrawalCurrency;
  exchangeRate: number;
}): WithdrawalQuote {
  const grossAmount = Number(params.amount);
  const exchangeRate = Number(params.exchangeRate);
  if (!Number.isFinite(grossAmount) || grossAmount < 0) throw new Error('invalid_withdrawal_amount');
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error('invalid_exchange_rate');

  const sourceCurrency: WithdrawalCurrency = params.sourceCurrency === 'USD' ? 'USD' : 'HTG';
  const payoutCurrency = resolveWithdrawalPayoutCurrency(params.method);
  const feeRate = payoutCurrency === 'USD' ? 0.02 : 0.05;
  const fees = grossAmount * feeRate;
  const netSourceAmount = grossAmount - fees;
  const convertedAmount = sourceCurrency === payoutCurrency
    ? netSourceAmount
    : sourceCurrency === 'HTG'
      ? netSourceAmount / exchangeRate
      : netSourceAmount * exchangeRate;

  return {
    sourceCurrency,
    payoutCurrency,
    grossAmount,
    feeRate,
    fees,
    netSourceAmount,
    exchangeRate,
    payoutAmount: Math.round((convertedAmount + Number.EPSILON) * 100) / 100,
  };
}
