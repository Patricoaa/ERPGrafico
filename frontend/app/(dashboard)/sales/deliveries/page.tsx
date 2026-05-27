"use client"

import { lazy, Suspense } from "react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useRouter } from "next/navigation"
import { SaleOrder } from "@/features/sales/types"
import { SalesOrdersView } from "@/features/sales/components/SalesOrdersView"

const DeliveryDrawer = lazy(() =>
    import("@/features/sales/components/DeliveryDrawer").then(m => ({ default: m.default }))
)

export default function SalesDeliveriesPage() {
    const router = useRouter()

    // 1. Usar useSelectedEntity para atrapar ?selected=<id> y fetchear la orden
    const { entity: selectedOrder, isLoading, clearSelection } = useSelectedEntity<SaleOrder>({
        endpoint: '/api/sales/orders'
    })

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <SalesOrdersView 
                viewMode="orders" 
                // Cuando hagan clic en la fila de la orden en vez del hub, podemos 
                // forzarlos a abrir deliveries? El click por defecto en SalesOrdersView abre el HubPanel.
                // Podemos dejarlo como está, o pasar un onRowClick (pero SalesOrdersView no expone onRowClick para overriding fácil).
                // Para despachar, la gente usará universal search -> /sales/deliveries?selected=123
            />

            {/* 2. Montar el modal existente (DeliveryDrawer) controlado por ?selected */}
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
