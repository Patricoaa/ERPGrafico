"use client"

import { useState, lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { SalesOrdersView } from "./SalesOrdersView"
import { ShoppingCart } from "lucide-react"

// Lazy load heavy components
const SaleOrderForm = lazy(() => import("@/features/sales/components/forms/SaleOrderForm"))
const SalesCheckoutWizard = lazy(() => import("./SalesCheckoutWizard"))
const TransactionViewModal = lazy(() => import("@/components/shared/TransactionViewModal"))
const DeliveryModal = lazy(() => import("./DeliveryModal"))
const DocumentCompletionModal = lazy(() => import("@/components/shared/DocumentCompletionModal"))
const SaleNoteModal = lazy(() => import("./SaleNoteModal"))

interface SalesOrdersClientViewProps {
    viewMode: 'orders' | 'notes'
}

export function SalesOrdersClientView({ viewMode }: SalesOrdersClientViewProps) {
    const [editingOrder, setEditingOrder] = useState<any | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view: 'details' | 'history' } | null>(null)
    const [payingOrder, setPayingOrder] = useState<any | null>(null)
    const [dispatchingOrder, setDispatchingOrder] = useState<number | null>(null)
    const [completingFolio, setCompletingFolio] = useState<any | null>(null)
    const [addingNote, setAddingNote] = useState<any | null>(null)
    const [checkoutData, setCheckoutData] = useState<any | null>(null)
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Notas de Venta"
                description="Gestiona tus pedidos, facturación y estados de entrega de forma centralizada."
            >
                {editingOrder && (
                    <Suspense fallback={null}>
                        <SaleOrderForm
                            initialData={editingOrder}
                            open={isFormOpen && !!editingOrder}
                            onOpenChange={(open: boolean) => {
                                setIsFormOpen(open)
                                if (!open) setEditingOrder(null)
                            }}
                            onSuccess={() => setIsFormOpen(false)}
                        />
                    </Suspense>
                )}
            </PageHeader>

            <SalesOrdersView viewMode={viewMode} />

            {viewingTransaction && (
                <Suspense fallback={null}>
                    <TransactionViewModal
                        open={!!viewingTransaction}
                        onOpenChange={(open: boolean) => !open && setViewingTransaction(null)}
                        type={viewingTransaction.type}
                        id={viewingTransaction.id}
                        view={viewingTransaction.view}
                    />
                </Suspense>
            )}

            {(payingOrder || checkoutData) && (
                <Suspense fallback={null}>
                    <SalesCheckoutWizard
                        open={!!payingOrder || !!checkoutData}
                        onOpenChange={(open: boolean) => {
                            if (!open) {
                                setPayingOrder(null)
                                setCheckoutData(null)
                            }
                        }}
                        order={payingOrder}
                        orderLines={(payingOrder?.lines || checkoutData?.lines || []).map((l: any) => ({
                            ...l,
                            id: l.product,
                            product_name: l.product_name || l.description,
                            name: l.product_name || l.description,
                            code: l.product_code || l.code,
                            qty: l.quantity,
                            unit_price_net: l.unit_price,
                        }))}
                        total={payingOrder ? parseFloat(payingOrder.total) : (checkoutData?.lines?.reduce((sum: number, l: any) => sum + (l.quantity * (l.unit_price || 0)) * 1.19, 0) || 0)}
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
                <Suspense fallback={null}>
                    <DeliveryModal
                        open={!!dispatchingOrder}
                        onOpenChange={(open: boolean) => !open && setDispatchingOrder(null)}
                        orderId={dispatchingOrder}
                        onSuccess={() => setDispatchingOrder(null)}
                    />
                </Suspense>
            )}

            {completingFolio && (
                <Suspense fallback={null}>
                    <DocumentCompletionModal
                        open={!!completingFolio}
                        onOpenChange={(open: boolean) => !open && setCompletingFolio(null)}
                        invoiceId={completingFolio.related_documents?.invoices?.find((inv: any) => inv.number === 'Draft')?.id || completingFolio.related_documents?.invoices?.[0]?.id}
                        invoiceType={completingFolio.related_documents?.invoices?.find((inv: any) => inv.number === 'Draft')?.type || "BOLETA"}
                        onSuccess={() => setCompletingFolio(null)}
                    />
                </Suspense>
            )}

            {addingNote && (
                <Suspense fallback={null}>
                    <SaleNoteModal
                        open={!!addingNote}
                        onOpenChange={(open: boolean) => !open && setAddingNote(null)}
                        orderId={addingNote.id}
                        orderNumber={addingNote.number}
                        invoiceId={addingNote.related_documents?.invoices?.[0]?.id}
                        onSuccess={() => setAddingNote(null)}
                    />
                </Suspense>
            )}
        </div>
    )
}

export default SalesOrdersClientView

