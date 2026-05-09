"use client"

import { Suspense, lazy } from "react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { TableSkeleton } from "@/components/shared"
import { useRouter } from "next/navigation"
import { SaleOrder } from "@/features/sales/types"

// Reutilizamos la vista de órdenes como lista base
const SalesOrdersView = lazy(() =>
    import("@/features/sales/components/SalesOrdersView").then(m => ({ default: m.SalesOrdersView }))
)
const DeliveryModal = lazy(() =>
    import("@/features/sales/components/DeliveryModal").then(m => ({ default: m.default }))
)

export default function SalesDeliveriesPage() {
    const router = useRouter()

    // 1. Usar useSelectedEntity para atrapar ?selected=<id> y fetchear la orden
    const { entity: selectedOrder, isLoading, clearSelection } = useSelectedEntity<SaleOrder>({
        endpoint: '/api/sales/orders'
    })

    return (
        <div className="w-full pt-2 h-full">
            <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                <SalesOrdersView 
                    viewMode="orders" 
                    // Cuando hagan clic en la fila de la orden en vez del hub, podemos 
                    // forzarlos a abrir deliveries? El click por defecto en SalesOrdersView abre el HubPanel.
                    // Podemos dejarlo como está, o pasar un onRowClick (pero SalesOrdersView no expone onRowClick para overriding fácil).
                    // Para despachar, la gente usará universal search -> /sales/deliveries?selected=123
                />
            </Suspense>

            {/* 2. Montar el modal existente (DeliveryModal) controlado por ?selected */}
            <Suspense fallback={null}>
                {(selectedOrder || isLoading) && (
                    <DeliveryModal
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
