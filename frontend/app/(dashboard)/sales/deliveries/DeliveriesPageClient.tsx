"use client"

import { lazy, Suspense } from "react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useRouter } from "next/navigation"
import { type SaleOrder, SalesOrdersView } from "@/features/sales"

const DeliveryDrawer = lazy(() =>
    import("@/features/sales").then(m => ({ default: m.DeliveryDrawer }))
)

export default function DeliveriesPageClient() {
    const router = useRouter()

    const { entity: selectedOrder, isLoading, clearSelection } = useSelectedEntity<SaleOrder>({
        endpoint: '/api/sales/orders'
    })

    return (
        <div className="h-full flex flex-col">
            <SalesOrdersView viewMode="orders" />

            <Suspense fallback={null}>
                {(selectedOrder || isLoading) && (
                    <DeliveryDrawer
                        open={!!selectedOrder || isLoading}
                        onOpenChange={(open) => {
                            if (!open) clearSelection()
                        }}
                        orderId={selectedOrder?.id as number}
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
