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

export const metadata: Metadata = {
    title: "Módulo de Facturación | ERPGrafico",
    description: "Gestión centralizada de documentos electrónicos emitidos y recibidos.",
}

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default async function BillingPage({ searchParams }: PageProps) {
    const { view } = await searchParams
    const viewMode = (view as 'sales' | 'purchases') || 'sales'

    const tabs = [
        { value: "sales", label: "Emitidos (Ventas)", iconName: "receipt", href: "/billing?view=sales" },
        { value: "purchases", label: "Recibidos (Compras)", iconName: "file-badge", href: "/billing?view=purchases" },
    ]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={viewMode === 'sales' ? "Facturación de Ventas" : "Facturación de Compras"}
                description="Control de documentos electrónicos, estados de pago y cumplimiento tributario."
                iconName={viewMode === 'sales' ? "receipt" : "file-badge"}
                variant="minimal"
                configHref="/settings/billing"
            />

            <PageTabs tabs={tabs} activeValue={viewMode} />

            <div className="pt-2">
                <Suspense fallback={<LoadingFallback />}>
                    {viewMode === 'sales' && <SalesInvoicesClientView />}
                    {viewMode === 'purchases' && <PurchaseInvoicesClientView />}
                </Suspense>
            </div>
        </div>
    )
}
