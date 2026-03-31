import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/ui/LoadingFallback"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { Tabs } from "@/components/ui/tabs"

const SalesOrdersClientView = lazy(() =>
    import("@/features/sales").then(m => ({ default: m.SalesOrdersClientView }))
)

export const metadata: Metadata = {
    title: "Notas de Venta | ERPGrafico",
    description: "Gestión de pedidos, facturación y estados de entrega.",
}

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default async function SalesOrdersPage({ searchParams }: PageProps) {
    const { view } = await searchParams
    const viewMode = (view as 'orders' | 'notes') || 'notes'

    const tabs = [
        { value: "orders", label: "Notas de Venta", iconName: "shopping-cart", href: "/sales/orders?view=orders" },
        { value: "notes", label: "Notas Crédito/Débito", iconName: "file-text", href: "/sales/orders?view=notes" },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={viewMode} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={viewMode} maxWidth="max-w-md" />
                <Suspense fallback={<LoadingFallback />}>
                    <SalesOrdersClientView viewMode={viewMode} />
                </Suspense>
            </Tabs>
        </div>
    )
}

