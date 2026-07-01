"use client"

import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { getNoteHubStatuses, getHubStatuses } from '@/features/orders'

interface UseOrderHubDataProps {
    orderId?: number | null
    invoiceId?: number | null
    type?: 'purchase' | 'sale' | 'obligation'
    enabled?: boolean
}

export function useOrderHubData({ orderId, invoiceId, type, enabled = true }: UseOrderHubDataProps) {
    const { 
        data, 
        isLoading: loading, 
        error,
        refetch: fetchOrderDetails
    } = useQuery({
        queryKey: ['orderHub', { orderId, invoiceId, type }],
        queryFn: async () => {
            if (!orderId && !invoiceId) return { activeInvoice: null, order: null }
            let activeInvoice = null
            let order = null
            
            if (invoiceId) {
                const invRes = await api.get(`/billing/invoices/${invoiceId}/`)
                activeInvoice = invRes.data

                if (invRes.data.sale_order || invRes.data.purchase_order) {
                    const oType = invRes.data.sale_order ? 'sales' : 'purchasing'
                    const oId = invRes.data.sale_order || invRes.data.purchase_order
                    const orderRes = await api.get(`/${oType}/orders/${oId}/`)
                    order = orderRes.data
                }
            } else if (orderId) {
                const endpoint =
                    type === 'purchase' ? `/purchasing/orders/${orderId}/` :
                        `/sales/orders/${orderId}/`
                const response = await api.get(endpoint)
                order = response.data
            }
            return { activeInvoice, order }
        },
        enabled: enabled && !!(orderId || invoiceId),
        staleTime: 1000 * 30, // 30 seconds cache
    })

    const { data: userPermissions = [] } = useQuery({
        queryKey: ['userPermissions'],
        queryFn: async () => {
            const response = await api.get('/auth/user/')
            return response.data.permissions || []
        },
        enabled: enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    })

    const { order, activeInvoice } = data || { order: null, activeInvoice: null }

    const activeDoc = order || activeInvoice
    const isNoteMode = activeInvoice && ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(activeInvoice.dte_type)
    const isSale = type === 'sale'
    const isCreditNote = activeInvoice?.dte_type === 'NOTA_CREDITO'

    // Status Calculations
    const activeOTs = (activeDoc?.work_orders as Array<Record<string, unknown>> || []).filter((ot) => ot.status !== 'CANCELLED')
    const totalOTs = activeOTs.length
    const totalOTProgress = totalOTs > 0
        ? activeOTs.reduce((sum: number, ot) => sum + ((ot.production_progress as number) || 0), 0) / totalOTs
        : 0

    const invoices = (activeDoc?.related_documents as Record<string, unknown>)?.invoices as Array<Record<string, unknown>> || []
    const noteStatuses = getNoteHubStatuses(activeInvoice || {})

    const billingIsComplete = (() => {
        if (!activeDoc) return false
        if (isNoteMode) return noteStatuses.billing === 'success'
        return invoices.length > 0 && !invoices.some((inv) =>
            inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number
        )
    })()

    const logisticsProgress = isNoteMode ? noteStatuses.logisticsProgress : (() => {
        if (!activeDoc) return 0
        const lines = (activeDoc.lines as Array<Record<string, unknown>> || activeDoc.items as Array<Record<string, unknown>> || [])
        if (lines.length === 0) return 0

        const totalOrdered = lines.reduce((acc: number, line) => acc + (Number(line.quantity ?? 0) || 0), 0)
        if (totalOrdered === 0) return 100

        const totalProcessed = lines.reduce((acc: number, line) => {
            const processedField = isSale
                ? (line.quantity_delivered !== undefined ? 'quantity_delivered' : 'delivered_quantity')
                : (line.quantity_received !== undefined ? 'quantity_received' : 'received_quantity')

            const processed = line[processedField] || 0
            return acc + (Number(processed) || 0)
        }, 0)

        return Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
    })()

    const payments = activeDoc?.serialized_payments || activeDoc?.payments_detail || activeDoc?.related_documents?.payments || []
    
    const showProduction = isSale && !isCreditNote && ((order?.work_orders?.length || 0) > 0 || (activeDoc?.lines as Array<Record<string, unknown>> || activeDoc?.items as Array<Record<string, unknown>> || []).some((l) => l.is_manufacturable))
    const showLogistics = (activeDoc?.lines as Array<Record<string, unknown>> || activeDoc?.items as Array<Record<string, unknown>> || []).length > 0 && !(activeDoc?.lines as Array<Record<string, unknown>> || activeDoc?.items as Array<Record<string, unknown>> || []).every((l) => l.product_type === 'SUBSCRIPTION')

    const hubStatuses = getHubStatuses(activeDoc || {})

    return {
        order,
        activeInvoice,
        activeDoc,
        loading,
        userPermissions,
        error,
        fetchOrderDetails,
        isNoteMode,
        isSale,
        isCreditNote,
        activeOTs,
        totalOTs,
        totalOTProgress,
        invoices,
        noteStatuses,
        billingIsComplete,
        logisticsProgress,
        payments,
        showProduction,
        showLogistics,
        hubStatuses
    }
}
