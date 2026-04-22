import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader } from "@/components/shared/PageHeader"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { LAYOUT_TOKENS } from "@/lib/styles"

const PurchasingOrdersClientView = lazy(() =>
    import("./orders/components/PurchasingOrdersClientView").then(m => ({ default: m.PurchasingOrdersClientView }))
)
const PurchasingSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.PurchasingSettingsView })))

export const metadata: Metadata = {
    title: "Módulo de Compras | ERPGrafico",
    description: "Gestión integral de órdenes de compra, notas y configuración.",
}

interface PageProps {
    searchParams: Promise<{ view?: string; modal?: string; tab?: string }>
}

export default async function PurchasingPage({ searchParams }: PageProps) {
    const { view, modal, tab } = await searchParams
    const configTab = tab || "global"
    const viewMode = (view as 'orders' | 'notes' | 'config') || 'orders'
    const modalOpen = modal === 'new'

    const tabs = [
        { value: "orders", label: "Órdenes", iconName: "shopping-cart", href: "/purchasing?view=orders" },
        { value: "notes", label: "Notas Crédito/Débito", iconName: "file-text", href: "/purchasing?view=notes" },
        { value: "config", label: "Config", iconName: "settings", href: "/purchasing?view=config" },
    ]

    const getHeaderConfig = () => {
        if (viewMode === 'config') return { title: "Configuración de Compras", description: "Gestione las cuentas de gastos para diferentes tipos de compras.", iconName: "settings" as const }
        return {
            title: viewMode === 'orders' ? "Órdenes de Compra" : "Notas de Crédito y Débito",
            description: viewMode === 'orders' ? "Gestión integral de órdenes de compra y recepciones" : "Gestión de notas de crédito y débito de proveedores",
            iconName: (viewMode === 'orders' ? "shopping-cart" : "file-text") as "shopping-cart" | "file-text",
        }
    }

    const config = getHeaderConfig()
    const createAction = viewMode === 'orders' ? <ToolbarCreateButton label="Nueva Orden" href="/purchasing?view=orders&modal=new" /> : null

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader title={config.title} description={config.description} iconName={config.iconName} variant="minimal" />
            <PageTabs tabs={tabs} activeValue={viewMode} />
            <div className="pt-4">
                <Suspense fallback={<LoadingFallback />}>
                    {(viewMode === 'orders' || viewMode === 'notes') && (
                        <PurchasingOrdersClientView viewMode={viewMode} externalOpenCheckout={modalOpen} createAction={createAction} />
                    )}
                    {viewMode === 'config' && (
                        <div className="pt-2">
                            <PurchasingSettingsView />
                        </div>
                    )}
                </Suspense>
            </div>
        </div>
    )
}
