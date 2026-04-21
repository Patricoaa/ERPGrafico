import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader } from "@/components/shared/PageHeader"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { LAYOUT_TOKENS } from "@/lib/styles"

// Lazy load feature components
const WorkOrdersView = lazy(() => import("@/app/(dashboard)/production/orders/page").then(m => ({ default: m.default })))
const BOMsView = lazy(() => import("@/app/(dashboard)/production/boms/page").then(m => ({ default: m.default })))
const ProductionSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.ProductionSettingsView })))


export const metadata: Metadata = {
    title: "Módulo de Producción | ERPGrafico",
    description: "Gestión centralizada de órdenes de trabajo, planificación y listas de materiales.",
}

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default async function ProductionPage({ searchParams }: PageProps) {
    const { view } = await searchParams
    const viewMode = (view as 'orders' | 'boms' | 'config') || 'orders'

    const tabs = [
        { value: "orders", label: "Órdenes de Trabajo", iconName: "clipboard-list", href: "/production?view=orders" },
        { value: "boms", label: "Lista de Materiales", iconName: "layers", href: "/production?view=boms" },
        { value: "config", label: "Config", iconName: "settings", href: "/production?view=config" },
    ]

    const getHeaderConfig = () => {
        switch (viewMode) {
            case 'config':
                return { title: "Configuración de Producción", description: "Parametrización de procesos y fichas de fabricación.", icon: "settings", createLabel: null, createHref: null }
            case 'orders':
                return { title: "Centro de Producción", description: "Gestión de procesos fabriles, órdenes de trabajo y seguimiento.", icon: "clipboard-list", createLabel: "Nueva OT", createHref: "/production?view=orders&modal=new" }
            case 'boms':
                return { title: "Fichas Técnicas (BOM)", description: "Estructuras de productos, componentes y costos de fabricación.", icon: "layers", createLabel: "Nueva Lista", createHref: "/production?view=boms&modal=new" }
            default:
                return { title: "Producción", description: "Módulo de gestión productiva.", icon: "factory", createLabel: null, createHref: null }
        }
    }

    const { title, description, icon, createLabel, createHref } = getHeaderConfig()
    const createAction = createLabel && createHref ? <ToolbarCreateButton label={createLabel} href={createHref} /> : null

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader title={title} description={description} iconName={icon} variant="minimal" />
            <PageTabs tabs={tabs} activeValue={viewMode} />
            <div className="pt-2">
                <Suspense fallback={<LoadingFallback />}>
                    {viewMode === 'orders' && <WorkOrdersView createAction={createAction} />}
                    {viewMode === 'boms' && <BOMsView createAction={createAction} />}
                    {viewMode === 'config' && <ProductionSettingsView />}
                </Suspense>
            </div>
        </div>
    )
}
