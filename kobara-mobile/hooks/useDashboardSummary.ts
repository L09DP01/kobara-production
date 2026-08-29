import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary, DashboardSummaryResponse } from '../services/dashboard';

export const useDashboardSummary = () => {
  return useQuery<DashboardSummaryResponse, Error>({
    queryKey: ['dashboardSummary'],
    queryFn: getDashboardSummary,
    staleTime: 1000 * 60, // Data is fresh for 1 minute
    retry: 2,
  });
};
