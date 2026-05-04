import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { TableSkeleton, PageHeader, ToolbarCreateButton } from "@/components/shared"
import { LAYOUT_TOKENS } from "@/lib/styles"


// Lazy load feature components
const SalesOrdersClientView = lazy(() => import("@/features/sales").then(m => ({ default: m.SalesOrdersClientView })))
const SalesTerminalsView = lazy(() => import("@/features/sales").then(m => ({ default: m.SalesTerminalsView })))
const CreditPortfolioView = lazy(() => import("@/features/credits").then(m => ({ default: m.CreditPortfolioView })))
const BlacklistView = lazy(() => import("@/features/credits").then(m => ({ default: m.BlacklistView })))
const SalesSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.SalesSettingsView })))


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
    const viewMode = (view as 'orders' | 'pos' | 'hardware' | 'credits' | 'config') || 'orders'
    const subView = sub || (
        viewMode === 'orders' ? 'orders' :
            viewMode === 'pos' ? 'pos-terminals' :
                viewMode === 'hardware' ? 'batches' :
                    'portfolio'
    )
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
            value: "pos",
            label: "POS",
            iconName: "banknote",
            href: "/sales?view=pos",
            subTabs: [
                { value: "pos-terminals", label: "CAJA/POS", href: "/sales?view=pos&sub=pos-terminals" },
                { value: "sessions", label: "Sesiones", href: "/sales?view=pos&sub=sessions" },
            ]
        },
        {
            value: "hardware",
            label: "Terminal de Cobro",
            iconName: "cpu",
            href: "/sales?view=hardware",
            subTabs: [
                { value: "providers", label: "Proveedor de dispositivos", href: "/sales?view=hardware&sub=providers" },
                { value: "devices", label: "Dispositivos", href: "/sales?view=hardware&sub=devices" },
                { value: "batches", label: "Lotes de Pago", href: "/sales?view=hardware&sub=batches" },
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
        { 
            value: "config", 
            label: "Config", 
            iconName: "settings", 
            href: "/sales?view=config",
            subTabs: [
                { value: "income", label: "Ingresos", href: "/sales?view=config&tab=income", iconName: "trending-up" },
                { value: "credit", label: "Crédito", href: "/sales?view=config&tab=credit", iconName: "credit-card" },
                { value: "config_pos", label: "POS", href: "/sales?view=config&tab=config_pos", iconName: "settings" },
                { value: "terminals", label: "Terminales", href: "/sales?view=config&tab=terminals", iconName: "wallet" }
            ]
        },
    ]

    const navigation = {
        tabs,
        activeValue: viewMode,
        subActiveValue: viewMode === 'config' ? configTab : subView,
        configHref: "/sales?view=config"
    }

    const getHeaderConfig = () => {
        if (viewMode === 'config') {
            return {
                title: "Configuración de Ventas",
                description: "Gestione los ingresos, políticas de crédito y parámetros del POS.",
                iconName: "settings" as const,
                showAction: false
            }
        }
        if (viewMode === 'orders') {
            return {
                title: subView === 'orders' ? "Notas de Venta" : "Notas de Crédito y Débito",
                description: subView === 'orders' ? "Seguimiento de pedidos, estados de fabricación y logística de entregas." : "Gestión de devoluciones, correcciones de facturación y ajustes de cuenta.",
                iconName: "shopping-cart" as const,
                showAction: false
            }
        }
        if (viewMode === 'pos') {
            if (subView === 'pos-terminals') {
                return {
                    title: "Cajas POS",
                    description: "Administre los puntos de venta y sus métodos de pago autorizados.",
                    iconName: "banknote" as const,
                    actionTitle: "Nueva Caja POS",
                    actionHref: "/sales?view=pos&sub=pos-terminals&modal=new-terminal",
                    showAction: true
                }
            } else {
                return {
                    title: "Historial de Sesiones",
                    description: "Registro cronológico de aperturas y cierres de cajas POS.",
                    iconName: "banknote" as const,
                    showAction: false
                }
            }
        }
        if (viewMode === 'hardware') {
            if (subView === 'batches') {
                return {
                    title: "Lotes de Pago",
                    description: "Gestión de cierres diarios y liquidaciones de tarjetas.",
                    iconName: "cpu" as const,
                    actionTitle: "Nuevo Lote",
                    actionHref: "/sales?view=hardware&sub=batches&modal=new-batch",
                    showAction: true
                }
            } else if (subView === 'devices') {
                return {
                    title: "Hardware de Pago",
                    description: "Gestione los dispositivos físicos y su vinculación con el sistema.",
                    iconName: "cpu" as const,
                    actionTitle: "Nuevo Dispositivo",
                    actionHref: "/sales?view=hardware&sub=devices&modal=new-device",
                    showAction: true
                }
            } else {
                return {
                    title: "Proveedores de Pago",
                    description: "Configuración de cuentas y comisiones por proveedor (TUU, Transbank, etc.).",
                    iconName: "cpu" as const,
                    actionTitle: "Nuevo Proveedor",
                    actionHref: "/sales?view=hardware&sub=providers&modal=new-provider",
                    showAction: true
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

    const createAction = config.showAction && 'actionHref' in config && config.actionHref ? (
        <ToolbarCreateButton
            label={('actionTitle' in config && config.actionTitle) || "Crear"}
            href={config.actionHref}
        />
    ) : null

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={config.title}
                description={config.description}
                iconName={config.iconName}
                variant="minimal"
                navigation={navigation}
            />

            <div className="pt-4">
                <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                    {viewMode === 'orders' && (
                        <div className="pt-2">
                            <SalesOrdersClientView
                                viewMode={subView === 'orders' ? 'orders' : 'notes'}
                                isCreateModalOpen={modal === 'new'}
                                createAction={createAction}
                            />
                        </div>
                    )}

                    {(viewMode === 'pos' || viewMode === 'hardware') && (
                        <div className="pt-2">
                            <SalesTerminalsView activeTab={subView} modal={modal} createAction={createAction} />
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
                                    createAction={createAction}
                                />
                            )}
                        </div>
                    )}

                    {viewMode === 'config' && (
                        <div className="pt-2">
                            <SalesSettingsView activeTab={configTab} />
                        </div>
                    )}
                </Suspense>
            </div>
        </div>
    )
}
