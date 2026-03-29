"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { getNoteHubStatuses, getHubStatuses } from "@/lib/order-status-utils"

interface UseOrderHubDataProps {
    orderId?: number | null
    invoiceId?: number | null
    type?: 'purchase' | 'sale' | 'obligation'
    enabled?: boolean
}

export function useOrderHubData({ orderId, invoiceId, type, enabled = true }: UseOrderHubDataProps) {
    const [order, setOrder] = useState<any>(null)
    const [activeInvoice, setActiveInvoice] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [userPermissions, setUserPermissions] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)

    const fetchOrderDetails = async () => {
        if (!orderId && !invoiceId) return
        setLoading(true)
        setError(null)
        try {
            if (invoiceId) {
                const invRes = await api.get(`/billing/invoices/${invoiceId}/`)
                setActiveInvoice(invRes.data)

                if (invRes.data.sale_order || invRes.data.purchase_order) {
                    const oType = invRes.data.sale_order ? 'sales' : 'purchasing'
                    const oId = invRes.data.sale_order || invRes.data.purchase_order
                    const orderRes = await api.get(`/${oType}/orders/${oId}/`)
                    setOrder(orderRes.data)
                } else {
                    setOrder(null)
                }
            } else if (orderId) {
                const endpoint =
                    type === 'purchase' ? `/purchasing/orders/${orderId}/` :
                        `/sales/orders/${orderId}/`
                const response = await api.get(endpoint)
                setOrder(response.data)
                setActiveInvoice(null)
            }
        } catch (err: any) {
            console.error("Error fetching order/invoice details:", err)
            setError(err.message || "Failed to fetch order details")
        } finally {
            setLoading(false)
        }
    }

    const fetchUserPermissions = async () => {
        try {
            const response = await api.get('/auth/user/')
            setUserPermissions(response.data.permissions || [])
        } catch (error) {
            console.error("Error fetching permissions:", error)
        }
    }

    useEffect(() => {
        if (enabled && (orderId || invoiceId)) {
            fetchOrderDetails()
            fetchUserPermissions()
        }
    }, [enabled, orderId, invoiceId, type])

    const activeDoc = activeInvoice || order
    const isNoteMode = activeInvoice && ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(activeInvoice.dte_type)
    const isSale = type === 'sale'
    const isCreditNote = activeInvoice?.dte_type === 'NOTA_CREDITO'

    // Status Calculations (copied from OrderCommandCenter)
    const activeOTs = activeDoc?.work_orders?.filter((ot: any) => ot.status !== 'CANCELLED') || []
    const totalOTs = activeOTs.length
    const totalOTProgress = totalOTs > 0
        ? activeOTs.reduce((sum: number, ot: any) => sum + (ot.production_progress || 0), 0) / totalOTs
        : 0

    const invoices = activeDoc?.related_documents?.invoices || []
    const noteStatuses = getNoteHubStatuses(activeInvoice || {})

    const billingIsComplete = (() => {
        if (!activeDoc) return false
        if (isNoteMode) return noteStatuses.billing === 'success'
        return invoices.length > 0 && !invoices.some((inv: any) =>
            inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number
        )
    })()

    const logisticsProgress = isNoteMode ? noteStatuses.logisticsProgress : (() => {
        if (!activeDoc) return 0
        const lines = activeDoc.lines || activeDoc.items || []
        if (lines.length === 0) return 0

        const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)
        if (totalOrdered === 0) return 100

        const totalProcessed = lines.reduce((acc: number, line: any) => {
            const processedField = isSale
                ? (line.quantity_delivered !== undefined ? 'quantity_delivered' : 'delivered_quantity')
                : (line.quantity_received !== undefined ? 'quantity_received' : 'received_quantity')

            const processed = line[processedField] || 0
            return acc + (parseFloat(processed) || 0)
        }, 0)

        return Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
    })()

    const payments = activeDoc?.serialized_payments || activeDoc?.payments_detail || activeDoc?.related_documents?.payments || []
    
    const showProduction = isSale && !isCreditNote && ((order?.work_orders?.length || 0) > 0 || (activeDoc?.lines || activeDoc?.items || []).some((l: any) => l.is_manufacturable))
    const showLogistics = (activeDoc?.lines || activeDoc?.items || []).length > 0 && !(activeDoc?.lines || activeDoc?.items || []).every((l: any) => l.product_type === 'SUBSCRIPTION')

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
