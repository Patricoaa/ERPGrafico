"use client"

import { useState } from "react"
import { SaleOrderForm } from "@/components/forms/SaleOrderForm"
import { SalesCheckoutWizard } from "@/components/sales/SalesCheckoutWizard"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { DeliveryModal } from "@/components/sales/DeliveryModal"
import { DocumentCompletionModal } from "@/components/shared/DocumentCompletionModal"
import { SaleNoteModal } from "@/components/sales/SaleNoteModal"
import { PageHeader } from "@/components/shared/PageHeader"
import { SalesOrdersView } from "@/components/sales/SalesOrdersView"
import { ShoppingCart } from "lucide-react"

export function SalesOrdersClientView() {
    const [editingOrder, setEditingOrder] = useState<any | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view: 'details' | 'history' } | null>(null)
    const [payingOrder, setPayingOrder] = useState<any | null>(null)
    const [dispatchingOrder, setDispatchingOrder] = useState<number | null>(null)
    const [completingFolio, setCompletingFolio] = useState<any | null>(null)
    const [addingNote, setAddingNote] = useState<any | null>(null)
    const [checkoutData, setCheckoutData] = useState<any | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)

    const triggerRefresh = () => setRefreshKey(prev => prev + 1)

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Notas de Venta"
                description="Gestiona tus pedidos, facturación y estados de entrega de forma centralizada."
            >
                {editingOrder && (
                    <SaleOrderForm
                        initialData={editingOrder}
                        open={isFormOpen && !!editingOrder}
                        onOpenChange={(open) => {
                            setIsFormOpen(open)
                            if (!open) setEditingOrder(null)
                        }}
                        onSuccess={triggerRefresh}
                    />
                )}
            </PageHeader>

            <SalesOrdersView key={refreshKey} onActionSuccess={triggerRefresh} />

            {viewingTransaction && (
                <TransactionViewModal
                    open={!!viewingTransaction}
                    onOpenChange={(open) => !open && setViewingTransaction(null)}
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                    view={viewingTransaction.view}
                />
            )}

            {(payingOrder || checkoutData) && (
                <SalesCheckoutWizard
                    open={!!payingOrder || !!checkoutData}
                    onOpenChange={(open) => {
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
                    onComplete={triggerRefresh}
                />
            )}

            {dispatchingOrder && (
                <DeliveryModal
                    open={!!dispatchingOrder}
                    onOpenChange={(open) => !open && setDispatchingOrder(null)}
                    orderId={dispatchingOrder}
                    onSuccess={triggerRefresh}
                />
            )}

            {completingFolio && (
                <DocumentCompletionModal
                    open={!!completingFolio}
                    onOpenChange={(open) => !open && setCompletingFolio(null)}
                    invoiceId={completingFolio.related_documents?.invoices?.find((inv: any) => inv.number === 'Draft')?.id || completingFolio.related_documents?.invoices?.[0]?.id}
                    invoiceType={completingFolio.related_documents?.invoices?.find((inv: any) => inv.number === 'Draft')?.type || "BOLETA"}
                    onSuccess={triggerRefresh}
                />
            )}

            {addingNote && (
                <SaleNoteModal
                    open={!!addingNote}
                    onOpenChange={(open) => !open && setAddingNote(null)}
                    orderId={addingNote.id}
                    orderNumber={addingNote.number}
                    invoiceId={addingNote.related_documents?.invoices?.[0]?.id}
                    onSuccess={triggerRefresh}
                />
            )}
        </div>
    )
}
