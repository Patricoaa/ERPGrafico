import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { Tabs } from "@/components/ui/tabs"

// Lazy load feature components
const SalesInvoicesClientView = lazy(() => import("@/features/billing/components/SalesInvoicesClientView").then(m => ({ default: m.SalesInvoicesClientView })))
const PurchaseInvoicesClientView = lazy(() => import("@/features/billing/components/PurchaseInvoicesClientView").then(m => ({ default: m.PurchaseInvoicesClientView })))
const BillingSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.BillingSettingsView })))
import { SettingsSheetRouteWrapper } from "@/components/shared"
import { Settings2 } from "lucide-react"

export const metadata: Metadata = {
    title: "Módulo de Facturación | ERPGrafico",
    description: "Gestión centralizada de documentos electrónicos emitidos y recibidos.",
}

interface PageProps {
    searchParams: Promise<{ view?: string; tab?: string }>
}

export default async function BillingPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams
    const configTab = tab || "accounts"
    const viewMode = (view as 'sales' | 'purchases') || 'sales'

    const tabs = [
        { value: "sales", label: "Emitidos (Ventas)", iconName: "receipt", href: "/billing?view=sales" },
        { value: "purchases", label: "Recibidos (Compras)", iconName: "file-badge", href: "/billing?view=purchases" },
    ]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={viewMode === 'sales' ? "Facturación de Ventas" : "Facturación de Compras"}
                description={viewMode === 'sales' 
                    ? "Gestión de boletas, facturas y notas de venta emitidas a clientes." 
                    : "Recepción y cuadratura de facturas y notas de crédito de proveedores."}
                iconName={viewMode === 'sales' ? "receipt" : "file-badge"}
                variant="minimal"
                configHref="?config=true"
            />

            <PageTabs tabs={tabs} activeValue={viewMode} />

            <div className="pt-2">
                <Suspense fallback={<LoadingFallback variant="list" />}>
                    {viewMode === 'sales' && <SalesInvoicesClientView />}
                    {viewMode === 'purchases' && <PurchaseInvoicesClientView />}
                </Suspense>
            </div>

            <SettingsSheetRouteWrapper
                sheetId="billing-settings"
                title="Configuración de Facturación"
                description="Gestione las cuentas contables, impuestos y parámetros de DTE."
                tabLabel="Configuración"
                fullWidth={600}
            >
                <Suspense fallback={<LoadingFallback variant="list" />}>
                    <BillingSettingsView activeTab={configTab} />
                </Suspense>
            </SettingsSheetRouteWrapper>
        </div>
    )
}
