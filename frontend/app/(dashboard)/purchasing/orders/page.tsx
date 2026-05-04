import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { LAYOUT_TOKENS } from "@/lib/styles"

const PurchasingOrdersClientView = lazy(() =>
    import("./components/PurchasingOrdersClientView").then(m => ({ default: m.PurchasingOrdersClientView }))
)

export const metadata: Metadata = {
    title: "Órdenes de Compra | ERPGrafico",
    description: "Gestión de órdenes de compra y notas.",
}

interface PageProps {
    searchParams: Promise<{ view?: string; modal?: string }>
}

export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
    const { view, modal } = await searchParams
    const viewMode = (view as 'orders' | 'notes') || 'orders'
    const modalOpen = modal === 'new'

    const tabs = [
        { value: "orders", label: "Ordenes", iconName: "shopping-cart", href: "/purchasing/orders?view=orders" },
        { value: "notes", label: "Notas Crédito/Débito", iconName: "file-text", href: "/purchasing/orders?view=notes" },
    ]

    const navigation = {
        tabs,
        activeValue: viewMode
    }

    const createAction = viewMode === 'orders' ? (
        <ToolbarCreateButton
            label="Nueva Orden"
            href="/purchasing/orders?view=orders&modal=new"
        />
    ) : null

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Gestión de Compras"
                description={viewMode === 'orders'
                    ? "Gestión integral de órdenes de compra y recepciones"
                    : "Gestión de notas de crédito y débito de proveedores"
                }
                iconName="shopping-bag"
                variant="minimal"
                navigation={navigation}
            />

            <div className="pt-4">
                <Suspense fallback={<LoadingFallback />}>
                    <PurchasingOrdersClientView viewMode={viewMode} externalOpenCheckout={modalOpen} createAction={createAction} />
                </Suspense>
            </div>
        </div>
    )
}

