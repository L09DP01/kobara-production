import { useQuery } from '@tanstack/react-query';
import { paymentsService } from '@/services/payments';

export function usePayments(params?: { status?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => paymentsService.getPayments(params),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function usePaymentLinks(params?: { status?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['payment-links', params],
    queryFn: () => paymentsService.getPaymentLinks(params),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useSubscriptions(params?: { status?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['subscriptions', params],
    queryFn: () => paymentsService.getSubscriptions(params),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
