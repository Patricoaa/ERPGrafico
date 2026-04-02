import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import Link from "next/link"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Store, ShoppingCart, Banknote, PieChart } from "lucide-react"
import { Button } from "@/components/ui/button"

// Lazy load feature components
const SalesOrdersClientView = lazy(() => import("@/features/sales").then(m => ({ default: m.SalesOrdersClientView })))
const SalesTerminalsView = lazy(() => import("@/features/sales/components/SalesTerminalsView").then(m => ({ default: m.default })))
const CreditPortfolioView = lazy(() => import("@/features/credits").then(m => ({ default: m.CreditPortfolioView })))
const BlacklistView = lazy(() => import("@/features/credits").then(m => ({ default: m.BlacklistView })))
const SalesSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.SalesSettingsView })))
import { SettingsSheetRouteWrapper } from "@/components/shared"
import { Settings2 } from "lucide-react"

export const metadata: Metadata = {
    title: "Módulo de Ventas | ERPGrafico",
    description: "Gestión integral de pedidos, terminales, cobranza y puntos de venta.",
}

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string; modal?: string; tab?: string }>
}

export default async function SalesPage({ searchParams }: PageProps) {
    const { view, sub, modal, tab } = await searchParams
    const configTab = tab || "income"
    const viewMode = (view as 'orders' | 'terminals' | 'credits') || 'orders'
    const subView = sub || (viewMode === 'orders' ? 'orders' : viewMode === 'terminals' ? 'terminals' : 'portfolio')
    const isModalOpen = !!modal

    const tabs = [
        { 
            value: "orders", 
            label: "Órdenes", 
            iconName: "shopping-cart", 
            href: "/sales?view=orders",
            subTabs: [
                { value: "orders", label: "Notas de Venta", href: "/sales?view=orders&sub=orders" },
                { value: "notes", label: "Ajustes (N/C N/D)", href: "/sales?view=orders&sub=notes" },
            ]
        },
        { 
            value: "terminals", 
            label: "Terminales", 
            iconName: "banknote", 
            href: "/sales?view=terminals",
            subTabs: [
                { value: "terminals", label: "Terminales", href: "/sales?view=terminals&sub=terminals" },
                { value: "batches", label: "Lotes", href: "/sales?view=terminals&sub=batches" },
                { value: "sessions", label: "Sesiones", href: "/sales?view=terminals&sub=sessions" },
            ]
        },
        { 
            value: "credits", 
            label: "Cartera", 
            iconName: "pie-chart", 
            href: "/sales?view=credits",
            subTabs: [
                { value: "portfolio", label: "Cartera", href: "/sales?view=credits&sub=portfolio" },
                { value: "history", label: "Historial", href: "/sales?view=credits&sub=history" },
                { value: "blacklist", label: "Lista Negra", href: "/sales?view=credits&sub=blacklist" },
            ]
        },
    ]

    const getHeaderConfig = () => {
        if (viewMode === 'orders') {
            return {
                title: subView === 'orders' ? "Notas de Venta" : "Notas de Crédito/Débito",
                description: "Seguimiento de pedidos y documentos de ajuste.",
                showAction: false
            }
        }
        if (viewMode === 'terminals') {
            return {
                title: "Terminales y Liquidaciones",
                description: "Gestión de puntos de cobro y lotes transaccionales.",
                actionTitle: subView === 'terminals' ? "Nuevo Terminal" : subView === 'batches' ? "Nueva Liquidación" : "",
                actionHref: `/sales?view=terminals&sub=${subView}&modal=${subView === 'terminals' ? 'new-terminal' : 'new-batch'}`,
                showAction: subView !== 'sessions'
            }
        }
        if (viewMode === 'credits') {
            return {
                title: "Cartera de Crédito",
                description: "Clasificación de deuda y gestión de cobranzas.",
                actionTitle: "Asignar Crédito",
                actionHref: "/sales?view=credits&sub=portfolio&modal=new",
                showAction: subView === 'portfolio'
            }
        }
        return { title: "Ventas", description: "", showAction: false }
    }

    const config = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={config.title}
                description={config.description}
                iconName={viewMode === 'orders' ? "shopping-cart" : viewMode === 'terminals' ? "banknote" : "pie-chart"}
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
            >
                <Link href="/pos" target="_blank">
                    <Button className="bg-primary hover:bg-primary/90 h-10 px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 font-bold uppercase tracking-wider text-[11px]">
                        <Store className="mr-2 h-4 w-4" />
                        Ir al POS
                    </Button>
                </Link>
            </PageHeader>

            <PageTabs tabs={tabs} activeValue={viewMode} subActiveValue={subView} />

            <div className="pt-4">
                <Suspense fallback={<LoadingFallback />}>
                    {viewMode === 'orders' && (
                        <div className="pt-2">
                            <SalesOrdersClientView 
                                viewMode={subView === 'orders' ? 'orders' : 'notes'} 
                                isCreateModalOpen={modal === 'new'}
                            />
                        </div>
                    )}

                    {viewMode === 'terminals' && (
                        <div className="pt-2">
                            <SalesTerminalsView activeTab={subView} modal={modal} />
                        </div>
                    )}

                    {viewMode === 'credits' && (
                        <div className="pt-2">
                            {subView === 'blacklist' ? (
                                <BlacklistView />
                            ) : (
                                <CreditPortfolioView 
                                    activeTab={subView as 'portfolio' | 'history'} 
                                    externalOpen={modal === 'new'} 
                                />
                            )}
                        </div>
                    )}
                </Suspense>
            </div>

            <SettingsSheetRouteWrapper
                sheetId="sales-settings"
                title="Configuración de Ventas"
                description="Gestione los ingresos, políticas de crédito y parámetros del POS."
                tabLabel="Configuración"
                fullWidth={600}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <SalesSettingsView activeTab={configTab} />
                </Suspense>
            </SettingsSheetRouteWrapper>
        </div>
    )
}
