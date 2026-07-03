"use client"

import { lazy, Suspense } from "react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useRouter } from "next/navigation"
import { type SaleOrder, SalesOrdersView } from "@/features/sales"

const UnifiedNoteWizard = lazy(() =>
    import("@/features/notes").then(m => ({ default: m.UnifiedNoteWizard }))
)

export default function ReturnsPageClient() {
    const router = useRouter()

    const { entity: selectedOrder, isLoading, clearSelection } = useSelectedEntity<SaleOrder>({
        endpoint: '/api/sales/orders'
    })

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <SalesOrdersView viewMode="notes" />

            <Suspense fallback={null}>
                {(selectedOrder || isLoading) && (
                    <UnifiedNoteWizard
                        open={!!selectedOrder || isLoading}
                        onOpenChange={(open) => {
                            if (!open) clearSelection()
                        }}
                        mode="sales"
                        initialType="NOTA_CREDITO"
                        features={{ logistics: true, manufacturing: true }}
                        referenceLabel={selectedOrder?.related_documents?.invoices?.[0]?.number as string | undefined}
                        fetchSource={async () => {
                            const invoiceId = selectedOrder?.related_documents?.invoices?.[0]?.id as number || 0;
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
                            const invoiceId = selectedOrder?.related_documents?.invoices?.[0]?.id as number || 0;
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
                        onSuccess={() => {
                            clearSelection()
                            router.refresh()
                        }}
                    />
                )}
            </Suspense>
        </div>
    )
}
