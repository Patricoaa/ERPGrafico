import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import Link from "next/link"
import { Tabs, TabsContent } from "@/components/ui/tabs"

// Lazy load feature components
const ProductList = lazy(() => import("@/features/inventory/components/ProductList").then(m => ({ default: m.ProductList })))
const CategoryList = lazy(() => import("@/features/inventory/components/CategoryList").then(m => ({ default: m.CategoryList })))
const PricingRuleList = lazy(() => import("@/features/inventory/components/PricingRuleList").then(m => ({ default: m.PricingRuleList })))
const StockReport = lazy(() => import("@/features/inventory/components/StockReport").then(m => ({ default: m.StockReport })))
const MovementList = lazy(() => import("@/features/inventory/components/MovementList").then(m => ({ default: m.MovementList })))
const WarehouseList = lazy(() => import("@/features/inventory/components/WarehouseList").then(m => ({ default: m.WarehouseList })))
const UoMsView = lazy(() => import("@/features/inventory/components/UoMsView").then(m => ({ default: m.UoMsView })))
const AttributeManager = lazy(() => import("@/features/inventory/components/AttributeManager").then(m => ({ default: m.AttributeManager })))
const SubscriptionsView = lazy(() => import("@/features/inventory/components/SubscriptionsView").then(m => ({ default: m.SubscriptionsView })))
const InventorySettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.InventorySettingsView })))
import { SettingsSheetRouteWrapper } from "@/components/shared"
import { Settings2 } from "lucide-react"

export const metadata: Metadata = {
    title: "Módulo de Inventario | ERPGrafico",
    description: "Gestión centralizada de productos, existencias, almacenes y configuración.",
}

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string; modal?: string }>
}

export default async function InventoryPage({ searchParams }: PageProps) {
    const { view, sub, modal, tab } = await searchParams
    const configTab = tab || "accounts"
    const viewMode = (view as 'products' | 'stock' | 'uoms' | 'attributes') || 'products'
    const subView = sub || (viewMode === 'products' ? 'items' : viewMode === 'stock' ? 'report' : 'units')
    const isModalOpen = modal === 'new' || modal === 'adjustment'

    const tabs = [
        { 
            value: "products", 
            label: "Productos", 
            iconName: "package", 
            href: "/inventory?view=products",
            subTabs: [
                { value: "items", label: "Catálogo", iconName: "package", href: "/inventory?view=products&sub=items" },
                { value: "categories", label: "Categorías", iconName: "layout-grid", href: "/inventory?view=products&sub=categories" },
                { value: "pricing-rules", label: "Precios", iconName: "banknote", href: "/inventory?view=products&sub=pricing-rules" },
                { value: "subscriptions", label: "Suscripciones", iconName: "calendar-clock", href: "/inventory?view=products&sub=subscriptions" },
            ]
        },
        { 
            value: "stock", 
            label: "Existencias", 
            iconName: "warehouse", 
            href: "/inventory?view=stock",
            subTabs: [
                { value: "report", label: "Reporte", iconName: "file-text", href: "/inventory?view=stock&sub=report" },
                { value: "movements", label: "Movimientos", iconName: "arrow-left-right", href: "/inventory?view=stock&sub=movements" },
                { value: "warehouses", label: "Almacenes", iconName: "warehouse", href: "/inventory?view=stock&sub=warehouses" },
            ]
        },
        { 
            value: "uoms", 
            label: "Unidades", 
            iconName: "scale", 
            href: "/inventory?view=uoms",
            subTabs: [
                { value: "units", label: "Unidades", iconName: "scale", href: "/inventory?view=uoms&sub=units" },
                { value: "categories", label: "Categorías", iconName: "layout-grid", href: "/inventory?view=uoms&sub=categories" },
            ]
        },
        { value: "attributes", label: "Atributos", iconName: "tags", href: "/inventory?view=attributes" },
    ]

    const getHeaderConfig = () => {
        if (viewMode === 'products') {
            const labels: Record<string, string> = { items: 'Productos', categories: 'Categorías', 'pricing-rules': 'Reglas', 'subscriptions': 'Suscripción' }
            return {
                title: subView === 'subscriptions' ? "Suscripciones y Recurrentes" : "Gestión de Productos",
                description: subView === 'subscriptions' ? "Gestión de servicios mensuales, contratos y facturación automática." : "Control de catálogo, categorías y precios.",
                actionTitle: labels[subView] ? `Nuevo ${labels[subView]}` : "Nuevo",
                actionHref: `/inventory?view=products&sub=${subView}&modal=new`,
                showAction: true
            }
        }
        if (viewMode === 'stock') {
            return {
                title: "Control de Existencias",
                description: "Monitoreo de stock, movimientos y bodegas.",
                actionTitle: subView === 'movements' ? "Nuevo Ajuste" : subView === 'warehouses' ? "Nuevo Almacén" : "",
                actionHref: `/inventory?view=stock&sub=${subView}&modal=${subView === 'movements' ? 'adjustment' : 'new'}`,
                showAction: subView !== 'report'
            }
        }
        if (viewMode === 'uoms') {
            const labels: Record<string, string> = { units: 'Unidad', categories: 'Categoría' }
            return {
                title: "Unidades de Medida",
                description: "Gestión de unidades y conversiones.",
                actionTitle: labels[subView] ? `Nueva ${labels[subView]}` : "Nuevo",
                actionHref: `/inventory?view=uoms&sub=${subView}&modal=new`,
                showAction: true
            }
        }
        if (viewMode === 'attributes') {
            return {
                title: "Atributos de Variantes",
                description: "Gestión de atributos para variaciones.",
                actionTitle: "Nuevo Atributo",
                actionHref: "/inventory?view=attributes&modal=new",
                showAction: true
            }
        }
        return { title: "Inventario", description: "", showAction: false }
    }

    const config = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={config.title}
                description={config.description}
                iconName="package"
                variant="minimal"
                configHref="?config=true"
                titleActions={config.showAction && config.actionHref && (
                    <Link href={config.actionHref}>
                        <PageHeaderButton
                            iconName="plus"
                            circular
                            title={config.actionTitle}
                        />
                    </Link>
                )}
            />

            <PageTabs tabs={tabs} activeValue={viewMode} subActiveValue={subView} />

            <div className="pt-4">
                <Suspense fallback={<LoadingFallback />}>
                    {viewMode === 'products' && (
                        <div className="pt-2">
                            {subView === 'items' && <ProductList externalOpen={modal === 'new'} />}
                            {subView === 'categories' && <CategoryList externalOpen={modal === 'new'} />}
                            {subView === 'pricing-rules' && <PricingRuleList externalOpen={modal === 'new'} />}
                            {subView === 'subscriptions' && <SubscriptionsView hideHeader externalOpen={modal === 'new'} />}
                        </div>
                    )}

                    {viewMode === 'stock' && (
                        <div className="pt-2">
                            {subView === 'report' && <StockReport />}
                            {subView === 'movements' && <MovementList externalOpen={modal === 'adjustment'} />}
                            {subView === 'warehouses' && <WarehouseList externalOpen={modal === 'new'} />}
                        </div>
                    )}

                    {viewMode === 'uoms' && (
                        <div className="pt-2">
                            <UoMsView 
                                activeTab={subView === 'categories' ? 'categories' : 'units'} 
                                externalOpen={modal === 'new'}
                            />
                        </div>
                    )}
                    
                    {viewMode === 'attributes' && <AttributeManager externalOpen={modal === 'new'} />}
                </Suspense>
            </div>

            <SettingsSheetRouteWrapper
                sheetId="inventory-settings"
                title="Configuración de Inventario"
                description="Gestione las cuentas de stock, ajustes y costo de ventas."
                tabLabel="Configuración"
                fullWidth={600}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <InventorySettingsView activeTab={configTab} />
                </Suspense>
            </SettingsSheetRouteWrapper>
        </div>
    )
}
