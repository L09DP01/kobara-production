import { apiClient } from '@/api/client';

export interface MobilePayment {
  id: string;
  amount: number;
  net_amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'expired' | 'refunded';
  provider: string;
  payment_method: string;
  created_at: string;
  kobara_reference: string;
  bazik_transaction_id: string;
  customers: { name: string; email: string } | null;
}

export interface MobilePaymentLink {
  id: string;
  slug: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  status: 'active' | 'inactive' | 'expired';
  created_at: string;
  expires_at: string | null;
  payment_count: number;
}

export interface MobileSubscription {
  id: string;
  amount: number;
  currency: string;
  status: 'active' | 'canceled' | 'past_due' | 'paused' | 'expired';
  billing_interval: string;
  next_billing_date: string | null;
  grace_period_end?: string | null;
  payment_status?: string | null;
  entitlement?: import('./dashboard').SubscriptionEntitlement;
  created_at: string;
  customers: { name: string; email: string } | null;
  plans: { name: string } | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  pagination: PaginationMeta;
  [key: string]: any;
}

export interface PaymentsResponse extends PaginatedResponse<MobilePayment> {
  payments: MobilePayment[];
}

export interface PaymentLinksResponse extends PaginatedResponse<MobilePaymentLink> {
  paymentLinks: MobilePaymentLink[];
}

export interface SubscriptionsResponse extends PaginatedResponse<MobileSubscription> {
  subscriptions: MobileSubscription[];
}

class PaymentsService {
  async getPayments(params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<PaymentsResponse> {
    const response = await apiClient.get<PaymentsResponse>('/mobile/payments', { params });
    return response.data;
  }

  async getPaymentLinks(params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<PaymentLinksResponse> {
    const response = await apiClient.get<PaymentLinksResponse>('/mobile/payment-links', { params });
    return response.data;
  }

  async getSubscriptions(params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<SubscriptionsResponse> {
    const response = await apiClient.get<SubscriptionsResponse>('/mobile/subscriptions', { params });
    return response.data;
  }

  async getPaymentDetails(id: string): Promise<{ payment: any }> {
    const response = await apiClient.get<{ payment: any }>(`/mobile/payments/${id}`);
    return response.data;
  }

  async getSubscriptionDetails(id: string): Promise<{ subscription: MobileSubscription }> {
    const response = await apiClient.get<{ subscription: MobileSubscription }>(`/mobile/subscriptions/${id}`);
    return response.data;
  }
}

export const paymentsService = new PaymentsService();
export default paymentsService;
