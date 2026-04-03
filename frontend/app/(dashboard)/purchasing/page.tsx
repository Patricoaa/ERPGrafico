import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import Link from "next/link"

const PurchasingOrdersClientView = lazy(() =>
    import("./orders/components/PurchasingOrdersClientView").then(m => ({ default: m.PurchasingOrdersClientView }))
)
const PurchasingSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.PurchasingSettingsView })))
import { SettingsSheetRouteWrapper } from "@/components/shared"
import { Settings2 } from "lucide-react"

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
    const viewMode = (view as 'orders' | 'notes') || 'orders'
    const modalOpen = modal === 'new'

    const tabs = [
        { value: "orders", label: "Órdenes", iconName: "shopping-cart", href: "/purchasing?view=orders" },
        { value: "notes", label: "Notas Crédito/Débito", iconName: "file-text", href: "/purchasing?view=notes" },
    ]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={viewMode === 'orders' ? "Órdenes de Compra" : "Notas de Crédito y Débito"}
                description={viewMode === 'orders' 
                    ? "Gestión integral de órdenes de compra y recepciones" 
                    : "Gestión de notas de crédito y débito de proveedores"
                }
                iconName={viewMode === 'orders' ? "shopping-cart" : "file-text"}
                variant="minimal"
                configHref="?config=true"
                titleActions={
                    viewMode === 'orders' && (
                        <Link href="/purchasing?view=orders&modal=new">
                            <PageHeaderButton
                                iconName="plus"
                                circular
                                title="Nueva Orden"
                            />
                        </Link>
                    )
                }
            />

            <PageTabs tabs={tabs} activeValue={viewMode} />

            <div className="pt-4">
                <Suspense fallback={<LoadingFallback />}>
                    <PurchasingOrdersClientView viewMode={viewMode} externalOpenCheckout={modalOpen} />
                </Suspense>
            </div>

            <SettingsSheetRouteWrapper
                sheetId="purchasing-settings"
                title="Configuración de Compras"
                description="Gestione las cuentas de gastos para diferentes tipos de compras."
                tabLabel="Configuración"
            >
                <Suspense fallback={<LoadingFallback />}>
                    <PurchasingSettingsView />
                </Suspense>
            </SettingsSheetRouteWrapper>
        </div>
    )
}
