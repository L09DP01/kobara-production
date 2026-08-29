import { useQuery } from '@tanstack/react-query';
import { paymentsService } from '../services/payments';

export function usePaymentDetails(id: string) {
  return useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentsService.getPaymentDetails(id),
    enabled: !!id,
    staleTime: 60000,
  });
}
