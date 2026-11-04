import { useMutation, useQuery } from '@tanstack/react-query'
import { staleTime } from '@/lib/query-config'
import { useRealtime } from '@/features/realtime'
import { billingApi } from '../api/billingApi'
import type { InvoiceableLinesParams, InvoiceFromLinesPayload } from '../types'
import { INVOICES_KEYS } from './queryKeys'

const INVOICEABLE_KEY = [...INVOICES_KEYS.all, 'invoiceable-lines'] as const

/** Líneas pendientes de facturar (ADR-0081). */
export function useInvoiceableLines(params: InvoiceableLinesParams, enabled = true) {
    return useQuery({
        queryKey: [...INVOICEABLE_KEY, params],
        queryFn: () => billingApi.getInvoiceableLines(params),
        enabled: enabled && (!!params.partner || !!params.orders?.length),
        staleTime: staleTime.volatile,
    })
}

/** Crea una factura parcial / multi-orden. El Idempotency-Key viaja en las variables (contrato idempotency.md). */
export function useCreateInvoiceFromLines() {
    const { markLocalMutation } = useRealtime()
    return useMutation({
        mutationFn: ({ payload, idempotencyKey }: { payload: InvoiceFromLinesPayload; idempotencyKey: string }) =>
            billingApi.createInvoiceFromLines(payload, idempotencyKey),
        onSuccess: () => {
            markLocalMutation()
        },
    })
}
