"use client"

import { Suspense, lazy } from "react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { TableSkeleton } from "@/components/shared"
import { useRouter } from "next/navigation"
import { SaleOrder } from "@/features/sales/types"

// Reutilizamos la vista de órdenes como lista base (podemos ver notas con viewMode="notes" o dejarlo en orders para ver de qué orden generar la nota)
// La convención original mostraba la pestaña de notes en /returns.
const SalesOrdersView = lazy(() =>
    import("@/features/sales/components/SalesOrdersView").then(m => ({ default: m.SalesOrdersView }))
)
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
        <div className="w-full pt-2 h-full">
            <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                <SalesOrdersView 
                    viewMode="notes"
                />
            </Suspense>

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
