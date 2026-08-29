import { useQuery } from '@tanstack/react-query';
import { customersService } from '../services/customers';

export const useCustomers = () => {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => customersService.getCustomers(),
    staleTime: 1000 * 30, // 30 seconds cache before background refetch
    retry: 2,
  });
};

export const useCustomerDetails = (id: string) => {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.getCustomerDetails(id),
    staleTime: 1000 * 30,
    retry: 2,
    enabled: !!id,
  });
};
