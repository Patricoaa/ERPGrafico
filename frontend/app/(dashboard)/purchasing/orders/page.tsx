import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"

const PurchasingOrdersClientView = lazy(() =>
    import("./components/PurchasingOrdersClientView").then(m => ({ default: m.PurchasingOrdersClientView }))
)

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const modalOpen = modal === 'new'

    const createAction = (
        <ToolbarCreateButton
            label="Nueva Orden"
            href="/purchasing/orders?modal=new"
        />
    )

    return (
        <Suspense fallback={<LoadingFallback />}>
            <PurchasingOrdersClientView viewMode="orders" externalOpenCheckout={modalOpen} createAction={createAction} />
        </Suspense>
    )
}
