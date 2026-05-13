import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { TrialBalanceReport } from '../types';

import { TRIAL_BALANCE_KEYS } from './queryKeys'

export { TRIAL_BALANCE_KEYS };

export function useTrialBalance(startDate?: string, endDate?: string) {
    const query = useQuery({
        queryKey: TRIAL_BALANCE_KEYS.period(startDate, endDate),
        queryFn: async ({ signal }) => {
            const params: Record<string, string> = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const response = await api.get('/finances/api/trial-balance/', { params, signal });
            return response.data as TrialBalanceReport;
        },
        staleTime: 5 * 60 * 1000, // 5 min
    });

    return {
        data: query.data ?? null,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error ? (query.error as Error).message : null,
        refetch: query.refetch,
    };
}
