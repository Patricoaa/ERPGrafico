import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { Tabs } from "@/components/ui/tabs"

// Lazy load feature components
const WorkOrdersView = lazy(() => import("@/app/(dashboard)/production/orders/page").then(m => ({ default: m.default })))
const BOMsView = lazy(() => import("@/app/(dashboard)/production/boms/page").then(m => ({ default: m.default })))
const ProductionSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.ProductionSettingsView })))
import { SettingsSheetRouteWrapper } from "@/components/shared"
import { Settings2 } from "lucide-react"

export const metadata: Metadata = {
    title: "Módulo de Producción | ERPGrafico",
    description: "Gestión centralizada de órdenes de trabajo, planificación y listas de materiales.",
}

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default async function ProductionPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams
    const configTab = tab || "global"
    const viewMode = (view as 'orders' | 'boms') || 'orders'

    const tabs = [
        { value: "orders", label: "Órdenes de Trabajo", iconName: "clipboard-list", href: "/production?view=orders" },
        { value: "boms", label: "Lista de Materiales", iconName: "layers", href: "/production?view=boms" },
    ]

    const getHeaderConfig = () => {
        switch (viewMode) {
            case 'orders':
                return {
                    title: "Centro de Producción",
                    description: "Gestión de procesos fabriles, órdenes de trabajo y seguimiento.",
                    icon: "factory",
                    action: (
                        <PageHeaderButton
                            href="/production?view=orders&modal=new"
                            iconName="plus"
                            circular
                            title="Nueva OT"
                        />
                    )
                }
            case 'boms':
                return {
                    title: "Fichas Técnicas (BOM)",
                    description: "Estructuras de productos, componentes y costos de fabricación.",
                    icon: "layers",
                    action: (
                        <PageHeaderButton
                            href="/production?view=boms&modal=new"
                            iconName="plus"
                            circular
                            title="Nueva Lista"
                        />
                    )
                }
            default:
                return { title: "Producción", description: "Módulo de gestión productiva.", icon: "factory", action: null }
        }
    }

    const { title, description, icon, action } = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={title}
                description={description}
                iconName={icon as any}
                variant="minimal"
                configHref="?config=true"
                titleActions={action}
            />

            <PageTabs tabs={tabs} activeValue={viewMode} />

            <div className="pt-2">
                <Suspense fallback={<LoadingFallback />}>
                    {viewMode === 'orders' && <WorkOrdersView />}
                    {viewMode === 'boms' && <BOMsView />}
                </Suspense>
            </div>

            <SettingsSheetRouteWrapper
                sheetId="production-settings"
                title="Configuración de Producción"
                description="Parametrización de procesos y fichas de fabricación."
                tabLabel="Configuración"
            >
                <Suspense fallback={<LoadingFallback />}>
                    <ProductionSettingsView />
                </Suspense>
            </SettingsSheetRouteWrapper>
        </div>
    )
}
