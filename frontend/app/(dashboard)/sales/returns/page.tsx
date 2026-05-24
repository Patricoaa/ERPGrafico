"use client"

import { lazy, Suspense } from "react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useRouter } from "next/navigation"
import { SaleOrder } from "@/features/sales/types"
import { SalesOrdersView } from "@/features/sales/components/SalesOrdersView"

const SaleNoteModal = lazy(() =>
    import("@/features/sales/components/SaleNoteModal").then(m => ({ default: m.default }))
)

export default function SalesReturnsPage() {
    const router = useRouter()

    // 1. Usar useSelectedEntity para atrapar ?selected=<id> y fetchear la orden
    const { entity: selectedOrder, isLoading, clearSelection } = useSelectedEntity<SaleOrder>({
        endpoint: '/api/sales/orders'
    })

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <SalesOrdersView 
                viewMode="notes"
            />

            {/* 2. Montar el modal existente (SaleNoteModal) controlado por ?selected */}
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
