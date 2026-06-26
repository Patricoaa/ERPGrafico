"use client"

import { useState, lazy, Suspense } from "react"
import { useInvoices } from "@/features/billing"
import { useVatRate } from "@/hooks/useVatRate"
import { SalesOrdersView } from "./SalesOrdersView"
import { FadeIn, SkeletonShell } from "@/components/shared"
import { type SaleOrder, type SaleOrderLine } from "../types"
import { type Invoice } from "@/features/billing/types"
import { useEntitySubscription } from "@/features/realtime"
import { SALES_KEYS } from "../hooks/queryKeys"

const SALES_ORDER_LIST_KEYS = [[...SALES_KEYS.all, 'orders']] as const

// Lazy load heavy components
const SalesCheckoutWizard = lazy(() => import("./SalesCheckoutWizard"))
const DeliveryDrawer = lazy(() => import("./DeliveryDrawer"))
const DocumentCompletionModal = lazy(() => import("@/components/shared/DocumentCompletionModal"))
const SaleNoteModal = lazy(() => import("./SaleNoteModal"))

interface SalesOrdersClientViewProps {
    viewMode: 'orders' | 'notes'
}

export function SalesOrdersClientView({ viewMode }: SalesOrdersClientViewProps) {
    const { multiplier: vatMultiplier } = useVatRate()
    const { confirmInvoice } = useInvoices()

    // Remote-change / cross-tab refresh — see ADR-0026.
    useEntitySubscription('sales.saleorder', [...SALES_ORDER_LIST_KEYS])

    const [payingOrder, setPayingOrder] = useState<SaleOrder | null>(null)
    const [dispatchingOrder, setDispatchingOrder] = useState<number | null>(null)
    const [completingFolio, setCompletingFolio] = useState<SaleOrder | null>(null)
    const [addingNote, setAddingNote] = useState<SaleOrder | null>(null)
    const [checkoutData, setCheckoutData] = useState<{ lines: SaleOrderLine[] } | null>(null)

    return (
        <>
            <FadeIn key={viewMode} className="h-full">
                <SalesOrdersView viewMode={viewMode} />
            </FadeIn>

            {/* Modals & Forms */}
             {(payingOrder || checkoutData) && (
                 <SkeletonShell isLoading={true} ariaLabel="Cargando wizard de checkout">
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
                         total={payingOrder ? parseFloat(payingOrder.total.toString()) : (checkoutData?.lines?.reduce((sum: number, l: SaleOrderLine) => sum + (l.quantity * (l.unit_price || 0)) * vatMultiplier, 0) || 0)}
                         initialCustomerId={payingOrder?.customer?.toString()}
                         initialCustomerName={payingOrder?.customer_name}
                         channel={checkoutData ? "SALE" : "POS"}
                         onComplete={() => {
                             setPayingOrder(null)
                             setCheckoutData(null)
                         }}
                     />
                 </SkeletonShell>
             )}

             {dispatchingOrder && (
                 <SkeletonShell isLoading={true} ariaLabel="Cargando modal de entrega">
                     <DeliveryDrawer
                         open={!!dispatchingOrder}
                         onOpenChange={(open: boolean) => !open && setDispatchingOrder(null)}
                         orderId={dispatchingOrder}
                         onSuccess={() => setDispatchingOrder(null)}
                     />
                 </SkeletonShell>
             )}

             {completingFolio && (
                 <SkeletonShell isLoading={true} ariaLabel="Cargando modal de completion">
                     <DocumentCompletionModal
                         open={!!completingFolio}
                         onOpenChange={(open: boolean) => !open && setCompletingFolio(null)}
                         invoiceId={completingFolio.related_documents?.invoices?.find((inv: Invoice) => inv.number === 'Draft')?.id || completingFolio.related_documents?.invoices?.[0]?.id || 0}
                         invoiceType={(completingFolio.related_documents?.invoices?.find((inv: Invoice) => inv.number === 'Draft') as any)?.type || "BOLETA"}
                         contactId={completingFolio?.customer}
                         isPurchase={false}
                         onComplete={async (invoiceId, formData) => {
                             // confirmInvoice invalida INVOICES_QUERY_KEY + SALES_KEYS.all
                             // → lista de invoices y orden de venta padre se refrescan.
                             await confirmInvoice({ id: invoiceId, payload: formData })
                         }}
                         onSuccess={() => setCompletingFolio(null)}
                     />
                 </SkeletonShell>
             )}

             {addingNote && (
                 <SkeletonShell isLoading={true} ariaLabel="Cargando modal de nota de venta">
                     <Suspense fallback={<div />}>
                         <SaleNoteModal
                             open={!!addingNote}
                             onOpenChange={(open: boolean) => !open && setAddingNote(null)}
                             orderId={addingNote?.id}
                             orderNumber={addingNote?.number}
                             invoiceId={addingNote?.related_documents?.invoices?.[0]?.id}
                             onSuccess={() => setAddingNote(null)}
                         />
                     </Suspense>
                 </SkeletonShell>
             )}
        </>
    )
}

export default SalesOrdersClientView
