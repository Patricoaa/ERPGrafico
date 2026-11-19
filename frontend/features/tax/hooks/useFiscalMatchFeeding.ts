'use client'

import { useQuery } from '@tanstack/react-query'
import { staleTime } from '@/lib/query-config'
import { fiscalMatchApi } from '../api/fiscalMatchApi'
import { FISCAL_MATCH_KEYS } from './fiscalMatchKeys'
import { useGroupMutation } from './useFiscalMatches'

/** Borradores de compra del mismo RUT con total parecido a un grupo con RCV sin factura. */
export function useFiscalMatchDraftSuggestions(groupId: number, enabled: boolean) {
    const { data, isLoading, isError } = useQuery({
        queryKey: FISCAL_MATCH_KEYS.draftSuggestions(groupId),
        queryFn: () => fiscalMatchApi.draftSuggestions(groupId),
        enabled: enabled && groupId > 0,
        staleTime: staleTime.standard,
    })
    return { suggestions: data ?? [], isLoading, isError }
}

/** OC no anuladas del proveedor del grupo, para crear un borrador desde una de ellas. */
export function useFiscalMatchPurchaseOrders(groupId: number, enabled: boolean) {
    const { data, isLoading, isError } = useQuery({
        queryKey: FISCAL_MATCH_KEYS.purchaseOrders(groupId),
        queryFn: () => fiscalMatchApi.purchaseOrders(groupId),
        enabled: enabled && groupId > 0,
        staleTime: staleTime.standard,
    })
    return { orders: data ?? [], isLoading, isError }
}

/** Asigna folio y fecha del RCV al borrador, lo emite y lo une al grupo. */
export function useConfirmFiscalMatchDraft() {
    return useGroupMutation(
        (v: { id: number; invoiceId: number }, key) => fiscalMatchApi.confirmDraft(v.id, v.invoiceId, key),
        { success: 'Factura emitida con el folio del RCV', error: 'No se pudo emitir el borrador' },
    )
}

/** Crea un borrador de compra desde la OC con el folio del RCV, ya unido al grupo. */
export function useCreateFiscalMatchDraft() {
    return useGroupMutation(
        (v: { id: number; purchaseOrderId: number }, key) =>
            fiscalMatchApi.createDraft(v.id, v.purchaseOrderId, key),
        { success: 'Borrador creado desde la OC', error: 'No se pudo crear el borrador' },
    )
}

/** Crea una factura de venta emitida en el ERP desde el documento del RCV. */
export function useCreateFiscalMatchSale() {
    return useGroupMutation(
        (v: { id: number; contactId?: number }, key) =>
            fiscalMatchApi.createSale(v.id, v.contactId, key),
        { success: 'Factura de venta creada y vinculada en el ERP', error: 'No se pudo crear la factura de venta' },
    )
}
