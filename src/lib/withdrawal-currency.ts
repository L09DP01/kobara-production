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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  const grossAmount = roundMoney(Number(params.amount));
  const exchangeRate = Number(params.exchangeRate);
  if (!Number.isFinite(grossAmount) || grossAmount < 0) throw new Error('invalid_withdrawal_amount');
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error('invalid_exchange_rate');

  const sourceCurrency: WithdrawalCurrency = params.sourceCurrency === 'USD' ? 'USD' : 'HTG';
  const payoutCurrency = resolveWithdrawalPayoutCurrency(params.method);
  const feeRate = payoutCurrency === 'USD' ? 0.02 : 0.05;
  const fees = roundMoney(grossAmount * feeRate);
  const netSourceAmount = roundMoney(grossAmount - fees);
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
    payoutAmount: roundMoney(convertedAmount),
  };
}
