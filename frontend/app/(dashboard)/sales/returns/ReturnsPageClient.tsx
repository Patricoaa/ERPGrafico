"use client"

import { lazy, Suspense } from "react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useRouter } from "next/navigation"
import { type SaleOrder, SalesOrdersView } from "@/features/sales"

const SaleNoteModal = lazy(() =>
    import("@/features/sales").then(m => ({ default: m.SaleNoteModal }))
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
                    <SaleNoteModal
                        open={!!selectedOrder || isLoading}
                        onOpenChange={(open) => {
                            if (!open) clearSelection()
                        }}
                        orderId={selectedOrder?.id as number}
                        orderNumber={selectedOrder?.number}
                        invoiceId={selectedOrder?.related_documents?.invoices?.[0]?.id}
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
