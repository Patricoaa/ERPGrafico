import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { TrialBalanceReport } from '../types';
import { showApiError } from '@/lib/errors';

export function useTrialBalance() {
    const [data, setData] = useState<TrialBalanceReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchTrialBalance = useCallback(async (startDate?: string, endDate?: string) => {
        setIsLoading(true);
        try {
            const params: Record<string, string> = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const response = await api.get('/finances/api/trial-balance/', { params });
            setData(response.data);
        } catch (error) {
            console.error('Error fetching trial balance:', error);
            showApiError(error, 'Error al cargar el balance de comprobación');
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        data,
        isLoading,
        fetchTrialBalance
    };
}
