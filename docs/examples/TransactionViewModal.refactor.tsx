/**
 * TransactionViewModal — REFACTORED
 * 
 * Key changes from original (756 lines → ~180 lines main component):
 * 
 * 1. Extracted data fetching to `useTransactionData` hook
 * 2. Extracted navigation history to `useNavigationHistory` hook
 * 3. Extracted header logic to `TransactionHeader` sub-component
 * 4. Extracted content rendering to type-specific sub-components
 * 5. Removed direct `api` import — all fetching via hooks
 * 6. Replaced hardcoded colors with semantic tokens
 * 7. Proper TypeScript types throughout
 */

"use client"

import React, { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { BaseModal } from "@/components/shared/BaseModal"
import { Loader2 } from "lucide-react"

// === TYPES (moved to types file) ===

export type TransactionType =
    | 'sale_order' | 'purchase_order' | 'invoice' | 'payment'
    | 'journal_entry' | 'inventory' | 'stock_move' | 'work_order'
    | 'sale_delivery' | 'purchase_receipt' | 'sale_return'
    | 'purchase_return' | 'cash_movement'

export interface TransactionLine {
    id?: number | string
    product_type?: string
    subtotal?: string | number
    amount?: string | number
    discount_amount?: string | number
    product_name?: string
    product_code?: string
    quantity?: number | string
    uom_name?: string
    unit_price_gross?: number
    unit_price?: number
    unit_cost?: number
    description?: string
    account_name?: string
    account_code?: string
    label?: string
    debit?: string | number
    credit?: string | number
}

export interface TransactionData {
    id?: number | string
    display_id?: string
    number?: string | number
    status?: string | number
    total?: number | string
    total_net?: number | string
    total_tax?: number | string
    amount?: number | string
    payment_type?: string
    payment_method?: string
    dte_type?: string
    movement_type?: string
    from_container_name?: string
    to_container_name?: string
    lines?: TransactionLine[]
    items?: TransactionLine[]
    // ... other typed fields
}

// === HOOK: useTransactionData ===
// In real implementation, this would be in a separate file

import { useState, useEffect } from "react"
import { toast } from "sonner"

// API endpoints map — single source of truth
const ENDPOINT_MAP: Record<string, (id: number | string) => string> = {
    sale_order: (id) => `/sales/orders/${id}/`,
    purchase_order: (id) => `/purchasing/orders/${id}/`,
    invoice: (id) => `/billing/invoices/${id}/`,
    payment: (id) => `/treasury/payments/${id}/`,
    journal_entry: (id) => `/accounting/entries/${id}/`,
    inventory: (id) => `/inventory/moves/${id}/`,
    stock_move: (id) => `/inventory/moves/${id}/`,
    work_order: (id) => `/production/orders/${id}/`,
    sale_delivery: (id) => `/sales/deliveries/${id}/`,
    purchase_receipt: (id) => `/purchasing/receipts/${id}/`,
    sale_return: (id) => `/sales/returns/${id}/`,
    purchase_return: (id) => `/purchasing/returns/${id}/`,
    cash_movement: (id) => `/treasury/cash-movements/${id}/`,
}

interface UseTransactionDataOptions {
    type: TransactionType
    id: number | string
    enabled: boolean
}

interface UseTransactionDataReturn {
    data: TransactionData | null
    loading: boolean
    refetch: () => Promise<void>
}

function useTransactionData({ type, id, enabled }: UseTransactionDataOptions): UseTransactionDataReturn {
    const [data, setData] = useState<TransactionData | null>(null)
    const [loading, setLoading] = useState(false)

    const fetchData = async () => {
        if (!id || id === 0) return

        const getEndpoint = ENDPOINT_MAP[type.toLowerCase()]
        if (!getEndpoint) {
            console.error(`[TransactionViewModal] No endpoint for type: ${type}`)
            return
        }

        try {
            setLoading(true)
            // In real implementation: const response = await api.get(getEndpoint(id))
            // setData(response.data)
        } catch (error) {
            const err = error as { response?: { data?: { error?: string } }; message?: string }
            toast.error(`Error al cargar: ${err.response?.data?.error || err.message || "Error desconocido"}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (enabled && id && id !== 0) {
            fetchData()
        }
        if (!enabled) {
            setData(null)
        }
    }, [enabled, id, type])

    return { data, loading, refetch: fetchData }
}

// === HOOK: useNavigationHistory ===

interface NavigationEntry {
    type: TransactionType
    id: number | string
}

function useNavigationHistory(initialType: TransactionType, initialId: number | string) {
    const [history, setHistory] = useState<NavigationEntry[]>([])
    const [current, setCurrent] = useState<NavigationEntry>({ type: initialType, id: initialId })

    useEffect(() => {
        setCurrent({ type: initialType, id: initialId })
        setHistory([])
    }, [initialType, initialId])

    const navigateTo = (type: TransactionType, id: number | string) => {
        setHistory(prev => [...prev, current])
        setCurrent({ type, id })
    }

    const goBack = () => {
        if (history.length === 0) return
        const prev = history[history.length - 1]
        setHistory(h => h.slice(0, -1))
        setCurrent(prev)
    }

    return {
        currentType: current.type,
        currentId: current.id,
        canGoBack: history.length > 0,
        navigateTo,
        goBack,
    }
}

// === HELPER: getHeaderInfo ===

interface HeaderInfo {
    main: string
    sub: string
}

function getHeaderInfo(type: TransactionType, data: TransactionData | null): HeaderInfo {
    if (!data) return { main: "DETALLE DE TRANSACCIÓN", sub: "" }

    const headerMap: Record<string, () => HeaderInfo> = {
        sale_order: () => ({
            main: "Nota de Venta",
            sub: data.display_id || `NV-${data.number || data.id}`,
        }),
        purchase_order: () => ({
            main: "Orden de Compra y Servicios",
            sub: data.display_id || `OCS-${data.number || data.id}`,
        }),
        payment: () => ({
            main: data.payment_type === 'INBOUND' ? 'Comprobante de Ingreso' : 'Comprobante de Egreso',
            sub: data.display_id || `${data.payment_type === 'INBOUND' ? 'DEP' : 'RET'}-${data.id}`,
        }),
        journal_entry: () => ({
            main: "Asiento Contable",
            sub: data.display_id || `AS-${data.number || data.id}`,
        }),
        // ... add remaining types
    }

    return headerMap[type]?.() || { main: "Detalles de Transacción", sub: "" }
}

// === MAIN COMPONENT (now ~80 lines) ===

interface TransactionViewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: TransactionType
    id: number | string
    view?: 'details' | 'history' | 'all'
}

export function TransactionViewModal({
    open,
    onOpenChange,
    type: initialType,
    id: initialId,
    view = 'all',
}: TransactionViewModalProps) {
    const { currentType, currentId, canGoBack, navigateTo, goBack } =
        useNavigationHistory(initialType, initialId)

    const { data, loading, refetch } = useTransactionData({
        type: currentType,
        id: currentId,
        enabled: open,
    })

    const contentRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({
        contentRef,
        documentTitle: () => getHeaderInfo(currentType, data).main,
    })

    const { main: mainTitle, sub: subTitle } = getHeaderInfo(currentType, data)

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={mainTitle + (subTitle ? ` - ${subTitle}` : "")}
            headerClassName="sr-only"
            size="xl"
            hideScrollArea
            className="overflow-hidden p-0 gap-0"
        >
            <div className="flex flex-col h-[90vh] md:h-[85vh] max-h-[900px] bg-background">
                {/* Header */}
                <TransactionHeader
                    mainTitle={mainTitle}
                    subTitle={subTitle}
                    currentType={currentType}
                    canGoBack={canGoBack}
                    onGoBack={goBack}
                    onPrint={handlePrint}
                    onClose={() => onOpenChange(false)}
                />

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {loading ? (
                        <LoadingState />
                    ) : data ? (
                        <TransactionContent
                            type={currentType}
                            data={data}
                            view={view}
                            navigateTo={navigateTo}
                            onRefetch={refetch}
                        />
                    ) : null}
                </div>
            </div>
        </BaseModal>
    )
}

// === SUB-COMPONENTS (each in their own file) ===

function LoadingState() {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
                <Loader2 className="h-12 w-12 animate-spin text-primary absolute top-0 left-0 [animation-delay:-0.2s]" />
            </div>
            <p className="text-[11px] font-black text-primary/40 uppercase tracking-[0.2em] animate-pulse">
                Procesando Información
            </p>
        </div>
    )
}

// These would be in separate files:
// TransactionHeader.tsx — header bar with navigation, title, print button
// TransactionContent.tsx — dispatcher that renders the correct view by type
// TransactionSidebar.tsx — right sidebar with metadata
// TransactionLineTable.tsx — line items table (generic for all types)
// TransactionTotals.tsx — totals summary section

function TransactionHeader(props: {
    mainTitle: string
    subTitle: string
    currentType: TransactionType
    canGoBack: boolean
    onGoBack: () => void
    onPrint: () => void
    onClose: () => void
}) {
    // Extract ~60 lines of header JSX from original
    return <div>Header placeholder - see original for full implementation</div>
}

function TransactionContent(props: {
    type: TransactionType
    data: TransactionData
    view: string
    navigateTo: (type: TransactionType, id: number | string) => void
    onRefetch: () => void
}) {
    // Dispatcher that renders type-specific content
    // Each type has its own ~50-80 line component
    return <div>Content placeholder - see original for full implementation</div>
}

export default TransactionViewModal
