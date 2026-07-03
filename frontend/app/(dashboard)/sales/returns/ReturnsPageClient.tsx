"use client"

import { lazy, Suspense } from "react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useRouter } from "next/navigation"
import { type SaleOrder, SalesOrdersView } from "@/features/sales"

const NoteCheckoutWizard = lazy(() =>
    import("@/features/billing").then(m => ({ default: m.NoteCheckoutWizard }))
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
                    <NoteCheckoutWizard
                        open={!!selectedOrder || isLoading}
                        onOpenChange={(open) => {
                            if (!open) clearSelection()
                        }}
                        orderId={selectedOrder?.id as number || 0}
                        invoiceId={selectedOrder?.related_documents?.invoices?.[0]?.id || 0}
                        initialType="NOTA_CREDITO"
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
