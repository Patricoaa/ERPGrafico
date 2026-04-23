import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { PageTabs, TableSkeleton, PageHeader, ToolbarCreateButton } from "@/components/shared"
import { LAYOUT_TOKENS } from "@/lib/styles"


// Lazy load feature components
const TreasuryMovementsClientView = lazy(() => import("@/features/treasury").then(m => ({ default: m.TreasuryMovementsClientView })))
const TreasuryAccountsView = lazy(() => import("@/features/treasury").then(m => ({ default: m.TreasuryAccountsView })))
const StatementsList = lazy(() => import("@/features/finance").then(m => ({ default: m.StatementsList })))
const ReconciliationDashboard = lazy(() => import("@/features/finance").then(m => ({ default: m.ReconciliationDashboard })))
const ReconciliationRules = lazy(() => import("@/features/finance").then(m => ({ default: m.ReconciliationRules })))
const TreasurySettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.TreasurySettingsView })))


export const metadata: Metadata = {
    title: "Módulo de Tesorería | ERPGrafico",
    description: "Gestión centralizada de cuentas, movimientos y conciliación bancaria.",
}

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string; modal?: string }>
}

export default async function TreasuryPage({ searchParams }: PageProps) {
    const { view, sub, modal } = await searchParams
    const viewMode = (view as 'movements' | 'accounts' | 'reconciliation' | 'config') || 'movements'
    const subView = sub || (viewMode === 'accounts' ? 'accounts' : viewMode === 'reconciliation' ? 'statements' : '')
    const isModalOpen = !!modal

    const tabs = [
        { value: "movements", label: "Movimientos", iconName: "banknote", href: "/treasury?view=movements" },
        { 
            value: "accounts", 
            label: "Cuentas y Caja", 
            iconName: "landmark", 
            href: "/treasury?view=accounts",
            subTabs: [
                { value: "accounts", label: "Cuentas", href: "/treasury?view=accounts&sub=accounts" },
                { value: "banks", label: "Bancos", href: "/treasury?view=accounts&sub=banks" },
                { value: "methods", label: "Métodos", href: "/treasury?view=accounts&sub=methods" },
            ]
        },
        { 
            value: "reconciliation", 
            label: "Conciliación", 
            iconName: "history", 
            href: "/treasury?view=reconciliation",
            subTabs: [
                { value: "statements", label: "Cartolas", iconName: "file-text", href: "/treasury?view=reconciliation&sub=statements" },
                { value: "dashboard", label: "Dashboard", iconName: "bar-chart-3", href: "/treasury?view=reconciliation&sub=dashboard" },
                { value: "rules", label: "Reglas", iconName: "wand-2", href: "/treasury?view=reconciliation&sub=rules" },
            ]
        },
        { value: "config", label: "Config", iconName: "settings", href: "/treasury?view=config" },
    ]

    const getHeaderConfig = () => {
        if (viewMode === 'config') {
            return {
                title: "Configuración de Tesorería",
                description: "Gestione las cuentas de ajuste para conciliación bancaria y movimientos de caja.",
                iconName: "settings" as const,
                showAction: false
            }
        }
        if (viewMode === 'movements') {
            return {
                title: "Movimientos de Tesorería",
                description: "Registro histórico de ingresos, egresos y traslados de fondos.",
                iconName: "banknote" as const,
                actionTitle: "Nuevo Movimiento",
                actionHref: "/treasury?view=movements&modal=new",
                actionIcon: "plus",
                showAction: true
            }
        }
        if (viewMode === 'accounts') {
            if (subView === 'banks') {
                return {
                    title: "Gestión de Bancos",
                    description: "Administre las entidades bancarias globales del sistema.",
                    iconName: "landmark" as const,
                    actionTitle: "Nuevo Banco",
                    actionHref: "/treasury?view=accounts&sub=banks&modal=new",
                    actionIcon: "plus",
                    showAction: true
                }
            } else if (subView === 'methods') {
                return {
                    title: "Métodos de Pago",
                    description: "Configure los medios de pago aceptados y sus cuentas vinculadas.",
                    iconName: "landmark" as const,
                    actionTitle: "Nuevo Método",
                    actionHref: "/treasury?view=accounts&sub=methods&modal=new",
                    actionIcon: "plus",
                    showAction: true
                }
            } else {
                return {
                    title: "Cuentas de Tesorería",
                    description: "Registre y configure sus cuentas bancarias y de efectivo.",
                    iconName: "landmark" as const,
                    actionTitle: "Nueva Cuenta",
                    actionHref: "/treasury?view=accounts&sub=accounts&modal=new",
                    actionIcon: "plus",
                    showAction: true
                }
            }
        }
        if (viewMode === 'reconciliation') {
            if (subView === 'dashboard') {
                return {
                    title: "Dashboard de Conciliación",
                    description: "Métricas y resumen de la cuadratura contable y bancaria.",
                    iconName: "bar-chart-3" as const,
                    showAction: false
                }
            } else if (subView === 'rules') {
                return {
                    title: "Reglas de Conciliación",
                    description: "Configure reglas para la asignación automática de movimientos.",
                    iconName: "wand-2" as const,
                    actionTitle: "Nueva Regla",
                    actionHref: "/treasury?view=reconciliation&sub=rules&modal=new-rule",
                    actionIcon: "plus",
                    showAction: true
                }
            } else {
                return {
                    title: "Cartolas Bancarias",
                    description: "Importación y gestión de cartolas para conciliación.",
                    iconName: "file-text" as const,
                    actionTitle: "Importar Cartola",
                    actionHref: "/treasury?view=reconciliation&sub=statements&modal=import",
                    actionIcon: "upload",
                    showAction: true
                }
            }
        }
        return { title: "Tesorería", description: "", iconName: "banknote" as const, showAction: false }
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
            />

            <PageTabs tabs={tabs} activeValue={viewMode} subActiveValue={subView} />

            <div className="pt-4">
                <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                    {viewMode === 'movements' && (
                        <div className="pt-2">
                            <TreasuryMovementsClientView externalOpen={modal === 'new'} createAction={createAction} />
                        </div>
                    )}

                    {viewMode === 'accounts' && (
                        <div className="pt-2">
                            <TreasuryAccountsView activeTab={subView} externalOpen={modal === 'new'} createAction={createAction} />
                        </div>
                    )}

                    {viewMode === 'reconciliation' && (
                        <div className="pt-2">
                            {subView === 'statements' && <StatementsList externalOpen={modal === 'import'} createAction={createAction} />}
                            {subView === 'dashboard' && <ReconciliationDashboard />}
                            {subView === 'rules' && <ReconciliationRules externalOpen={modal === 'new-rule'} createAction={createAction} />}
                        </div>
                    )}

                    {viewMode === 'config' && (
                        <div className="pt-2">
                            <TreasurySettingsView />
                        </div>
                    )}
                </Suspense>
            </div>
        </div>
    )
}
