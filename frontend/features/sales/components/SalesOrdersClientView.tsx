"use client"

import { useState, useEffect, lazy, Suspense } from "react"
import api from "@/lib/api"
import { SalesOrdersView } from "./SalesOrdersView"
import { FormSkeleton } from "@/components/shared"
import { SaleOrder, SaleOrderLine } from "../types"
import { Invoice } from "@/features/billing/types"

// Lazy load heavy components
const SalesCheckoutWizard = lazy(() => import("./SalesCheckoutWizard"))
const DeliveryModal = lazy(() => import("./DeliveryModal"))
const DocumentCompletionModal = lazy(() => import("@/components/shared/DocumentCompletionModal"))
const SaleNoteModal = lazy(() => import("./SaleNoteModal"))

interface SalesOrdersClientViewProps {
    viewMode: 'orders' | 'notes'
    isCreateModalOpen?: boolean
    setCreateModalOpen?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function SalesOrdersClientView({ viewMode, isCreateModalOpen, setCreateModalOpen }: SalesOrdersClientViewProps) {
    const [payingOrder, setPayingOrder] = useState<SaleOrder | null>(null)
    const [dispatchingOrder, setDispatchingOrder] = useState<number | null>(null)
    const [completingFolio, setCompletingFolio] = useState<SaleOrder | null>(null)
    const [addingNote, setAddingNote] = useState<SaleOrder | null>(null)
    const [checkoutData, setCheckoutData] = useState<{ lines: SaleOrderLine[] } | null>(null)

    // Handle creation trigger for Notes view if needed
    useEffect(() => {
        if (isCreateModalOpen && viewMode === 'notes') {
            requestAnimationFrame(() => {
                setAddingNote({} as SaleOrder) // Open Note creation modal with dummy object
                if (setCreateModalOpen) setCreateModalOpen(false)
            })
        }
    }, [isCreateModalOpen, viewMode, setCreateModalOpen])

    return (
        <>
            <SalesOrdersView viewMode={viewMode} />

            {/* Modals & Forms */}
            {(payingOrder || checkoutData) && (
                <Suspense fallback={<FormSkeleton />}>
                    <SalesCheckoutWizard
                        open={!!payingOrder || !!checkoutData}
                        onOpenChange={(open: boolean) => {
                            if (!open) {
                                setPayingOrder(null)
                                setCheckoutData(null)
                            }
                        }}
                        order={payingOrder}
                        orderLines={(payingOrder?.lines || checkoutData?.lines || []).map((l: SaleOrderLine) => ({
                            ...l,
                            id: l.product as number,
                            product_name: l.product_name || l.description,
                            name: l.product_name || l.description,
                            code: (l as any).product_code || (l as any).code,
                            qty: l.quantity,
                            unit_price_net: l.unit_price,
                        }))}
                        total={payingOrder ? parseFloat(payingOrder.total.toString()) : (checkoutData?.lines?.reduce((sum: number, l: SaleOrderLine) => sum + (l.quantity * (l.unit_price || 0)) * 1.19, 0) || 0)}
                        initialCustomerId={payingOrder?.customer?.toString()}
                        initialCustomerName={payingOrder?.customer_name}
                        channel={checkoutData ? "SALE" : "POS"}
                        onComplete={() => {
                            setPayingOrder(null)
                            setCheckoutData(null)
                        }}
                    />
                </Suspense>
            )}

            {dispatchingOrder && (
                <Suspense fallback={<FormSkeleton />}>
                    <DeliveryModal
                        open={!!dispatchingOrder}
                        onOpenChange={(open: boolean) => !open && setDispatchingOrder(null)}
                        orderId={dispatchingOrder}
                        onSuccess={() => setDispatchingOrder(null)}
                    />
                </Suspense>
            )}

            {completingFolio && (
                <Suspense fallback={<FormSkeleton />}>
                    <DocumentCompletionModal
                        open={!!completingFolio}
                        onOpenChange={(open: boolean) => !open && setCompletingFolio(null)}
                        invoiceId={completingFolio.related_documents?.invoices?.find((inv: Invoice) => inv.number === 'Draft')?.id || completingFolio.related_documents?.invoices?.[0]?.id || 0}
                        invoiceType={(completingFolio.related_documents?.invoices?.find((inv: Invoice) => inv.number === 'Draft') as any)?.type || "BOLETA"}
                        contactId={completingFolio?.customer}
                        isPurchase={false}
                        onComplete={async (invoiceId, formData) => {
                            await api.post(`/billing/invoices/${invoiceId}/confirm/`, formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            })
                        }}
                        onSuccess={() => setCompletingFolio(null)}
                    />
                </Suspense>
            )}

            {addingNote && (
                <Suspense fallback={<FormSkeleton />}>
                    <SaleNoteModal
                        open={!!addingNote}
                        onOpenChange={(open: boolean) => !open && setAddingNote(null)}
                        orderId={addingNote?.id}
                        orderNumber={addingNote?.number}
                        invoiceId={addingNote?.related_documents?.invoices?.[0]?.id}
                        onSuccess={() => setAddingNote(null)}
                    />
                </Suspense>
            )}
        </>
    )
}

export default SalesOrdersClientView
