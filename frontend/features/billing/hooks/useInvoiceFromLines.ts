import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { staleTime } from '@/lib/query-config'
import { useRealtime } from '@/features/realtime'
import { SALES_KEYS } from '@/features/sales'
import { PURCHASING_KEYS } from '@/features/purchasing'
import { DOCUMENTS_KEYS } from '@/features/documents'
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
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    return useMutation({
        mutationFn: ({ payload, idempotencyKey }: { payload: InvoiceFromLinesPayload; idempotencyKey: string }) =>
            billingApi.createInvoiceFromLines(payload, idempotencyKey),
        onSuccess: (invoice) => {
            markLocalMutation()
            toast.success(`Factura ${invoice.display_id ?? ''} creada`)
            invalidateCrossFeature(queryClient, [INVOICES_KEYS.all, SALES_KEYS.all, PURCHASING_KEYS.all, DOCUMENTS_KEYS.all])
        },
    })
}
