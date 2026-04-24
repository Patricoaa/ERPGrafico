import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { PageTabs, CardSkeleton, PageHeader, ToolbarCreateButton } from "@/components/shared"
import { LAYOUT_TOKENS } from "@/lib/styles"

// Lazy load feature components
const SalesInvoicesClientView = lazy(() => import("@/features/billing").then(m => ({ default: m.SalesInvoicesClientView })))
const PurchaseInvoicesClientView = lazy(() => import("@/features/billing").then(m => ({ default: m.PurchaseInvoicesClientView })))
const BillingSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.BillingSettingsView })))

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
    const viewMode = (view as 'sales' | 'purchases' | 'config') || 'sales'

    const tabs = [
        { value: "sales", label: "Emitidos (Ventas)", iconName: "receipt", href: "/billing?view=sales" },
        { value: "purchases", label: "Recibidos (Compras)", iconName: "file-badge", href: "/billing?view=purchases" },
        { 
            value: "config", 
            label: "Config", 
            iconName: "settings", 
            href: "/billing?view=config",
            subTabs: [
                { value: "accounts", label: "Cuentas", href: "/billing?view=config&tab=accounts", iconName: "users" },
                { value: "tax", label: "Impuestos", href: "/billing?view=config&tab=tax", iconName: "percent" },
                { value: "dtes", label: "Documentos", href: "/billing?view=config&tab=dtes", iconName: "file-text" }
            ]
        },
    ]

    const getHeaderConfig = () => {
        if (viewMode === 'config') return { title: "Configuración de Facturación", description: "Gestione las cuentas contables, impuestos y parámetros de DTE.", iconName: "settings" as const }
        return {
            title: viewMode === 'sales' ? "Facturación de Ventas" : "Facturación de Compras",
            description: viewMode === 'sales'
                ? "Gestión de boletas, facturas y notas de venta emitidas a clientes."
                : "Recepción y cuadratura de facturas y notas de crédito de proveedores.",
            iconName: (viewMode === 'sales' ? "receipt" : "file-badge") as "receipt" | "file-badge",
        }
    }

    const config = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader title={config.title} description={config.description} iconName={config.iconName} variant="minimal" />
            <PageTabs tabs={tabs} activeValue={viewMode} subActiveValue={configTab} />

            <div className="pt-2">
                <Suspense fallback={<CardSkeleton variant="list" count={5} />}>
                    {viewMode === 'sales' && <SalesInvoicesClientView />}
                    {viewMode === 'purchases' && <PurchaseInvoicesClientView />}
                    {viewMode === 'config' && <BillingSettingsView activeTab={configTab} />}
                </Suspense>
            </div>
        </div>
    )
}
