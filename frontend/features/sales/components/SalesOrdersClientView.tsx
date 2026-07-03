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
const UnifiedNoteWizard = lazy(() => import("@/features/notes").then(m => ({ default: m.UnifiedNoteWizard })))

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
            <FadeIn key={viewMode}>
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
                              code: (l as unknown as Record<string, unknown>).product_code as string || (l as unknown as Record<string, unknown>).code as string,
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
                            invoiceType={(completingFolio.related_documents?.invoices?.find((inv: Invoice) => inv.number === 'Draft') as unknown as Record<string, unknown>)?.type as string || "BOLETA"}
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
                 <SkeletonShell isLoading={true} ariaLabel="Cargando wizard de nota de venta">
                     <Suspense fallback={<div />}>
                         <UnifiedNoteWizard
                             open={!!addingNote}
                             onOpenChange={(open: boolean) => !open && setAddingNote(null)}
                             mode="sales"
                             initialType="NOTA_CREDITO"
                             features={{ logistics: true, manufacturing: true }}
                             referenceLabel={addingNote?.related_documents?.invoices?.[0]?.number as string | undefined}
                             fetchSource={async () => {
                                 const invoiceId = addingNote?.related_documents?.invoices?.[0]?.id ?? 0;
                                 const { billingApi } = await import('@/features/billing/api/billingApi')
                                 const inv = (await billingApi.getInvoice(invoiceId) as unknown) as Record<string, unknown>
                                 const invLines = ((inv.lines as Record<string, unknown>[]) || []).map((l: Record<string, unknown>) => ({
                                     lineId: l.id as number,
                                     productId: l.product as number,
                                     productName: l.product_name as string,
                                     productCode: l.product_code as string | undefined,
                                     productType: l.product_type as string | undefined,
                                     trackInventory: l.track_inventory as boolean | undefined,
                                     hasBom: l.has_bom as boolean | undefined,
                                     requiresAdvancedManufacturing: l.requires_advanced_manufacturing as boolean | undefined,
                                     mfgAutoFinalize: l.mfg_auto_finalize as boolean | undefined,
                                     createsStockMove: (l.track_inventory as boolean) && (l.product_type as string) !== 'MANUFACTURABLE',
                                     uomName: l.uom_name as string | undefined,
                                     originalQuantity: (l.quantity_delivered as number) || (l.quantity as number),
                                     noteQuantity: 0,
                                     noteUnitPrice: (l.unit_price as number) || 0,
                                     taxAmountPerUnit: ((l.unit_price as number) || 0) * (((l.tax_rate as number) ?? 19) / 100),
                                     reason: '',
                                 }))
                                 return {
                                     label: `${inv.dte_type_display as string} ${inv.number as string}`,
                                     isExempt: (inv.dte_type as string) === 'FACTURA_EXENTA' || (inv.dte_type as string) === 'BOLETA_EXENTA',
                                     originalTotal: inv.total as number,
                                     lines: invLines,
                                 }
                             }}
                             onSubmit={async (payload) => {
                                 const invoiceId = addingNote?.related_documents?.invoices?.[0]?.id ?? 0;
                                 const { billingApi } = await import('@/features/billing/api/billingApi')
                                 const formData = new FormData()
                                 formData.append('original_invoice_id', invoiceId.toString())
                                 formData.append('note_type', payload.noteType)
                                 formData.append('selected_items', JSON.stringify(payload.lines.map(l => ({
                                     line_id: l.lineId,
                                     product_id: l.productId,
                                     quantity: l.noteQuantity,
                                     unit_price: l.noteUnitPrice,
                                     tax_amount: l.taxAmountPerUnit ?? 0,
                                     reason: l.reason ?? '',
                                     manufacturing_data: l.manufacturingData ?? null,
                                 }))))
                                 if (payload.logistics) formData.append('logistics_data', JSON.stringify(payload.logistics))
                                 const reg = payload.registration
                                 formData.append('registration_data', JSON.stringify({ document_number: reg.documentNumber, document_date: reg.documentDate, is_pending: reg.isPending }))
                                 if (reg.attachment) formData.append('document_attachment', reg.attachment)
                                 if (payload.payment.method) formData.append('payment_data', JSON.stringify(payload.payment))
                                 await billingApi.noteWorkflowCheckout(formData)
                             }}
                             onSuccess={() => setAddingNote(null)}
                         />
                     </Suspense>
                 </SkeletonShell>
             )}
        </>
    )
}

export default SalesOrdersClientView
