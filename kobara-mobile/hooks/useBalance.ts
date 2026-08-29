import { useQuery } from '@tanstack/react-query';
import { balanceService } from '../services/balance';

export const useBalance = () => {
  return useQuery({
    queryKey: ['balance'],
    queryFn: () => balanceService.getBalance(),
    staleTime: 1000 * 30, // 30 seconds
    retry: 2,
  });
};
