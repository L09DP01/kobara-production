import { apiClient } from '@/api/client';

export interface MobileActivityItem {
  id: string;
  type: 'withdrawal' | 'transfer_sent' | 'transfer_received';
  title: string;
  amount: number;
  amount_type: 'positive' | 'negative';
  status: 'pending' | 'completed' | 'succeeded' | 'failed';
  date: string;
  kobara_reference?: string;
  provider?: string;
  wallet?: string;
  total?: number;
  fees?: number;
}

export interface BalanceResponse {
  success: boolean;
  balance: number;
  currency: string;
  history: MobileActivityItem[];
}

class BalanceService {
  async getBalance(): Promise<BalanceResponse> {
    const response = await apiClient.get<BalanceResponse>('/mobile/balance');
    return response.data;
  }

  async sendB2BTransfer(recipientId: string, amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.post('/mobile/transfers', { recipientId, amount });
      return { success: true, ...response.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || "Erreur de transfert" };
    }
  }

  async requestWithdrawal(method: string, amount: number, reference: string): Promise<{ success: boolean; error?: string; withdrawal?: any }> {
    try {
      const response = await apiClient.post('/mobile/withdrawals', { method, amount, reference });
      return { success: true, ...response.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || "Erreur lors de la demande de retrait" };
    }
  }

  async lookupMerchant(email: string): Promise<{ success: boolean; merchant?: any; error?: string }> {
    try {
      const response = await apiClient.get(`/mobile/merchants/lookup?email=${encodeURIComponent(email)}`);
      return { success: true, merchant: response.data.merchant };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || "Marchand introuvable" };
    }
  }

  async lookupMerchantById(id: string): Promise<{ success: boolean; merchant?: any; error?: string }> {
    try {
      const response = await apiClient.get(`/mobile/merchants/lookup?id=${encodeURIComponent(id)}`);
      return { success: true, merchant: response.data.merchant };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || "Marchand introuvable" };
    }
  }
}

export const balanceService = new BalanceService();
export default balanceService;
