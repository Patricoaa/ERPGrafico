import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { FiscalYear, FiscalYearPreviewResult } from '../types';
import { showApiError } from '@/lib/errors';

export function useFiscalYears() {
    const [data, setData] = useState<FiscalYear[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<number | null>(null);

    const fetchFiscalYears = useCallback(async () => {
        try {
            const response = await api.get('/accounting/fiscal-years/?ordering=-year');
            const results = response.data.results || response.data;
            setData(results);
        } catch (error) {
            console.error('Error fetching fiscal years:', error);
            showApiError(error, 'Error al cargar los años fiscales');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const previewClosing = async (year: number): Promise<FiscalYearPreviewResult | null> => {
        setIsActionLoading(year);
        try {
            const response = await api.get(`/accounting/fiscal-years/${year}/preview-closing/`);
            return response.data;
        } catch (error) {
            showApiError(error, `Error al previsualizar el cierre del año ${year}`);
            return null;
        } finally {
            setIsActionLoading(null);
        }
    };

    const closeFiscalYear = async (year: number) => {
        setIsActionLoading(year);
        try {
            await api.post(`/accounting/fiscal-years/${year}/close/`);
            toast.success(`Año contable ${year} cerrado exitosamente.`);
            await fetchFiscalYears();
        } catch (error) {
            showApiError(error, `Error al cerrar el año contable ${year}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const reopenFiscalYear = async (year: number) => {
        setIsActionLoading(year);
        try {
            await api.post(`/accounting/fiscal-years/${year}/reopen/`);
            toast.success(`Año contable ${year} reabierto exitosamente.`);
            await fetchFiscalYears();
        } catch (error) {
            showApiError(error, `Error al reabrir el año contable ${year}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const generateOpeningEntry = async (year: number) => {
        setIsActionLoading(year);
        try {
            await api.post(`/accounting/fiscal-years/${year}/generate-opening/`);
            toast.success(`Asiento de apertura para el año ${year + 1} generado exitosamente.`);
            await fetchFiscalYears();
        } catch (error) {
            showApiError(error, `Error al generar el asiento de apertura para el año ${year + 1}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    return {
        data,
        isLoading,
        isActionLoading,
        fetchFiscalYears,
        previewClosing,
        closeFiscalYear,
        reopenFiscalYear,
        generateOpeningEntry
    };
}
