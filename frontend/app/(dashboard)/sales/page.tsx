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
                title: subView === 'orders' ? "Notas de Venta" : "Notas de Crédito y Débito",
                description: subView === 'orders' ? "Seguimiento de pedidos, estados de fabricación y logística de entregas." : "Gestión de devoluciones, correcciones de facturación y ajustes de cuenta.",
                iconName: "shopping-cart" as const,
                showAction: false
            }
        }
        if (viewMode === 'terminals') {
            if (subView === 'terminals') {
                return {
                    title: "Terminales POS",
                    description: "Administre los puntos de venta y sus métodos de pago autorizados.",
                    iconName: "banknote" as const,
                    actionTitle: "Nuevo Terminal",
                    actionHref: "/sales?view=terminals&sub=terminals&modal=new-terminal",
                    showAction: true
                }
            } else if (subView === 'batches') {
                return {
                    title: "Lotes de Liquidación",
                    description: "Registre liquidaciones y comisiones de terminales de cobro.",
                    iconName: "banknote" as const,
                    actionTitle: "Registrar Liquidación",
                    actionHref: "/sales?view=terminals&sub=batches&modal=new-batch",
                    showAction: true
                }
            } else {
                return {
                    title: "Historial de Sesiones",
                    description: "Registro cronológico de aperturas y cierres de terminales POS.",
                    iconName: "banknote" as const,
                    showAction: false
                }
            }
        }
        if (viewMode === 'credits') {
            if (subView === 'history') {
                return {
                    title: "Historial de Asignaciones",
                    description: "Registro global de créditos asignados a clientes.",
                    iconName: "pie-chart" as const,
                    showAction: false
                }
            } else if (subView === 'blacklist') {
                return {
                    title: "Lista Negra",
                    description: "Clientes con historial de impago o riesgo crediticio.",
                    iconName: "pie-chart" as const,
                    showAction: false
                }
            } else {
                return {
                    title: "Cartera de Créditos",
                    description: "Saldo por cliente, clasificación por antigüedad y estado de cobro.",
                    iconName: "pie-chart" as const,
                    actionTitle: "Asignar Crédito",
                    actionHref: "/sales?view=credits&sub=portfolio&modal=new",
                    showAction: true
                }
            }
        }
        return { title: "Ventas", description: "", iconName: "shopping-cart" as const, showAction: false }
    }

    const config = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={config.title}
                description={config.description}
                iconName={config.iconName}
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
