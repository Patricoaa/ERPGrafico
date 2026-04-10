import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { AccountingPeriod } from '../types';
import { showApiError } from '@/lib/errors';

export function useAccountingPeriods() {
    const [data, setData] = useState<AccountingPeriod[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<number | null>(null);

    const fetchPeriods = useCallback(async () => {
        try {
            const response = await api.get('/tax/accounting-periods/?ordering=-year,-month');
            const results = response.data.results || response.data;
            setData(results);
        } catch (error) {
            console.error('Error fetching periods:', error);
            showApiError(error, 'Error al cargar los periodos contables');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const closePeriod = async (periodId: number) => {
        setIsActionLoading(periodId);
        try {
            await api.post(`/tax/accounting-periods/${periodId}/close/`);
            toast.success('Periodo contable cerrado exitosamente');
            await fetchPeriods();
        } catch (error) {
            showApiError(error, 'Error al cerrar el periodo');
        } finally {
            setIsActionLoading(null);
        }
    };

    const reopenPeriod = async (periodId: number) => {
        setIsActionLoading(periodId);
        try {
            await api.post(`/tax/accounting-periods/${periodId}/reopen/`);
            toast.success('Periodo contable reabierto exitosamente');
            await fetchPeriods();
        } catch (error) {
            showApiError(error, 'Error al reabrir el periodo');
        } finally {
            setIsActionLoading(null);
        }
    };

    const createPeriod = async (year: number, month: number) => {
        setIsActionLoading(0); // Use 0 for global/new actions
        try {
            await api.post('/tax/accounting-periods/', { year, month });
            toast.success(`Periodo ${month}/${year} inicializado correctamente`);
            await fetchPeriods();
            return true;
        } catch (error) {
            showApiError(error, 'Error al crear el periodo');
            return false;
        } finally {
            setIsActionLoading(null);
        }
    };

    return {
        data,
        isLoading,
        isActionLoading,
        fetchPeriods,
        closePeriod,
        reopenPeriod,
        createPeriod
    };
}
