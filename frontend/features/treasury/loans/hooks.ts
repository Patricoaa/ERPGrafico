import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { loansApi } from './api'
import type {
    BankLoanCreatePayload, PayInstallmentPayload, PrepayLoanPayload,
    RefinanceLoanPayload, DisburseLoanPayload,
} from './types'

const LOANS_KEYS = {
    all: ['loans'] as const,
    lists: () => [...LOANS_KEYS.all, 'list'] as const,
    list: (params?: Record<string, string>) => [...LOANS_KEYS.lists(), params] as const,
    detail: (id: number) => [...LOANS_KEYS.all, 'detail', id] as const,
    schedule: (id: number) => [...LOANS_KEYS.all, 'schedule', id] as const,
    installments: () => [...LOANS_KEYS.all, 'installments'] as const,
    installmentsList: (params?: Record<string, string>) => [...LOANS_KEYS.installments(), params] as const,
}

export function useLoans(params?: Record<string, string>) {
    return useQuery({
        queryKey: LOANS_KEYS.list(params),
        queryFn: () => loansApi.list(params),
        staleTime: 2 * 60 * 1000,
    })
}

export function useLoan(id: number | null) {
    return useQuery({
        queryKey: LOANS_KEYS.detail(id ?? 0),
        queryFn: () => loansApi.get(id as number),
        enabled: id != null,
        staleTime: 60 * 1000,
    })
}

export function useLoanSchedule(id: number | null) {
    return useQuery({
        queryKey: LOANS_KEYS.schedule(id ?? 0),
        queryFn: () => loansApi.schedule(id as number),
        enabled: id != null,
        staleTime: 60 * 1000,
    })
}

export function useLoanInstallments(params?: Record<string, string>) {
    return useQuery({
        queryKey: LOANS_KEYS.installmentsList(params),
        queryFn: () => loansApi.listInstallments(params),
        staleTime: 60 * 1000,
    })
}

export function useLoanMutations() {
    const queryClient = useQueryClient()

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: LOANS_KEYS.all })
    }

    const create = useMutation({
        mutationFn: (payload: BankLoanCreatePayload) => loansApi.create(payload),
        onSuccess: () => { invalidate(); toast.success('Crédito creado') },
        onError: (e: Error) => showApiError(e, 'Error al crear crédito'),
    })

    const disburse = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload?: DisburseLoanPayload }) =>
            loansApi.disburse(id, payload),
        onSuccess: () => { invalidate(); toast.success('Crédito desembolsado') },
        onError: (e: Error) => showApiError(e, 'Error al desembolsar crédito'),
    })

    const prepay = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: PrepayLoanPayload }) =>
            loansApi.prepay(id, payload),
        onSuccess: () => { invalidate(); toast.success('Prepago registrado — crédito pagado') },
        onError: (e: Error) => showApiError(e, 'Error al prepagar crédito'),
    })

    const refinance = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: RefinanceLoanPayload }) =>
            loansApi.refinance(id, payload),
        onSuccess: () => { invalidate(); toast.success('Crédito marcado como refinanciado') },
        onError: (e: Error) => showApiError(e, 'Error al refinanciar crédito'),
    })

    const payInstallment = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: PayInstallmentPayload }) =>
            loansApi.payInstallment(id, payload),
        onSuccess: () => { invalidate(); toast.success('Cuota pagada') },
        onError: (e: Error) => showApiError(e, 'Error al pagar cuota'),
    })

    return {
        create: create.mutateAsync,
        disburse: disburse.mutateAsync,
        prepay: prepay.mutateAsync,
        refinance: refinance.mutateAsync,
        payInstallment: payInstallment.mutateAsync,
        isCreating: create.isPending,
        isDisbursing: disburse.isPending,
        isPrepaying: prepay.isPending,
        isRefinancing: refinance.isPending,
        isPaying: payInstallment.isPending,
    }
}
