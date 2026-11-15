'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { showApiError } from '@/lib/errors'
import { staleTime } from '@/lib/query-config'
import { reconciliationApi } from '../api/reconciliationApi'
import { RCV_DOCUMENTS_KEY, RECONCILIATION_KEYS } from './reconciliationKeys'

/** Borradores de compra del mismo RUT con total parecido a un documento RCV que falta en el ERP. */
export function useRcvDraftSuggestions(docId: number, enabled: boolean) {
    const { data, isLoading, isError } = useQuery({
        queryKey: RECONCILIATION_KEYS.rcvDraftSuggestions(docId),
        queryFn: () => reconciliationApi.getRcvDraftSuggestions(docId),
        enabled: enabled && docId > 0,
        staleTime: staleTime.standard,
    })
    return { suggestions: data ?? [], isLoading, isError }
}

/** OC no anuladas del proveedor del documento RCV, para crear un borrador desde una de ellas. */
export function useRcvSupplierPurchaseOrders(docId: number, enabled: boolean) {
    const { data, isLoading, isError } = useQuery({
        queryKey: RECONCILIATION_KEYS.rcvPurchaseOrders(docId),
        queryFn: () => reconciliationApi.getRcvPurchaseOrders(docId),
        enabled: enabled && docId > 0,
        staleTime: staleTime.standard,
    })
    return { orders: data ?? [], isLoading, isError }
}

function useInvalidateRcvFeeding() {
    const qc = useQueryClient()
    return () =>
        Promise.all([
            qc.invalidateQueries({ queryKey: RCV_DOCUMENTS_KEY }),
            qc.invalidateQueries({ queryKey: RECONCILIATION_KEYS.all }),
        ])
}

/** Asigna folio y fecha del RCV al borrador, lo emite y lo vincula. */
export function useConfirmRcvDraft() {
    const invalidate = useInvalidateRcvFeeding()
    const { markLocalMutation } = useRealtime()
    const { keyFor, succeeded, failed } = useIdempotencyKey()
    return useMutation({
        mutationFn: (payload: { docId: number; invoiceId: number }) =>
            reconciliationApi.confirmRcvDraft(payload.docId, payload.invoiceId, keyFor(payload)),
        onSuccess: () => {
            markLocalMutation()
            succeeded()
            toast.success('Factura emitida con el folio del RCV')
            return invalidate()
        },
        onError: (e) => {
            failed(e)
            showApiError(e, 'No se pudo emitir el borrador')
        },
    })
}

/** Crea un borrador de compra desde la OC con el folio del RCV, ya vinculado al documento. */
export function useCreateRcvDraft() {
    const invalidate = useInvalidateRcvFeeding()
    const { markLocalMutation } = useRealtime()
    const { keyFor, succeeded, failed } = useIdempotencyKey()
    return useMutation({
        mutationFn: (payload: { docId: number; purchaseOrderId: number }) =>
            reconciliationApi.createRcvDraft(payload.docId, payload.purchaseOrderId, keyFor(payload)),
        onSuccess: () => {
            markLocalMutation()
            succeeded()
            toast.success('Borrador creado desde la OC')
            return invalidate()
        },
        onError: (e) => {
            failed(e)
            showApiError(e, 'No se pudo crear el borrador')
        },
    })
}
