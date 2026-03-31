import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/ui/LoadingFallback"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { Tabs } from "@/components/ui/tabs"

const PurchasingOrdersClientView = lazy(() =>
    import("./components/PurchasingOrdersClientView").then(m => ({ default: m.PurchasingOrdersClientView }))
)

export const metadata: Metadata = {
    title: "Órdenes de Compra | ERPGrafico",
    description: "Gestión de órdenes de compra y notas.",
}

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
    const { view } = await searchParams
    const viewMode = (view as 'orders' | 'notes') || 'orders'

    const tabs = [
        { value: "orders", label: "Ordenes", iconName: "shopping-cart", href: "/purchasing/orders?view=orders" },
        { value: "notes", label: "Notas Crédito/Débito", iconName: "file-text", href: "/purchasing/orders?view=notes" },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={viewMode} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={viewMode} maxWidth="max-w-md" />
                <Suspense fallback={<LoadingFallback />}>
                    <PurchasingOrdersClientView viewMode={viewMode} />
                </Suspense>
            </Tabs>
        </div>
    )
}

