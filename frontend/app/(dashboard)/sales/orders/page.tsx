import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

const SalesOrdersClientView = lazy(() =>
    import("@/features/sales").then(m => ({ default: m.SalesOrdersClientView }))
)

export const metadata: Metadata = {
    title: "Notas de Venta | ERPGrafico",
    description: "Gestión de pedidos, facturación y estados de entrega.",
}

export default function SalesOrdersPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <SalesOrdersClientView />
        </Suspense>
    )
}
