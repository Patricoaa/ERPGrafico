import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import Link from "next/link"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Banknote, Landmark, History, FileText, BarChart3, Wand2, Plus, Upload } from "lucide-react"

// Lazy load feature components
const TreasuryMovementsClientView = lazy(() => import("@/features/treasury").then(m => ({ default: m.TreasuryMovementsClientView })))
const TreasuryAccountsView = lazy(() => import("@/features/treasury").then(m => ({ default: m.TreasuryAccountsView })))
const StatementsList = lazy(() => import("@/features/finance/bank-reconciliation/components").then(m => ({ default: m.StatementsList })))
const ReconciliationDashboard = lazy(() => import("@/features/finance/bank-reconciliation/components").then(m => ({ default: m.ReconciliationDashboard })))
const ReconciliationRules = lazy(() => import("@/features/finance/bank-reconciliation/components").then(m => ({ default: m.ReconciliationRules })))
const TreasurySettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.TreasurySettingsView })))
import { SettingsSheetRouteWrapper } from "@/components/shared"
import { Settings2 } from "lucide-react"

export const metadata: Metadata = {
    title: "Módulo de Tesorería | ERPGrafico",
    description: "Gestión centralizada de cuentas, movimientos y conciliación bancaria.",
}

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string; modal?: string }>
}

export default async function TreasuryPage({ searchParams }: PageProps) {
    const { view, sub, modal } = await searchParams
    const viewMode = (view as 'movements' | 'accounts' | 'reconciliation') || 'movements'
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
    ]

    const getHeaderConfig = () => {
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
                            iconName={config.actionIcon as any}
                            circular
                            title={config.actionTitle}
                        />
                    </Link>
                )}
            />

            <PageTabs tabs={tabs} activeValue={viewMode} subActiveValue={subView} />

            <div className="pt-4">
                <Suspense fallback={<LoadingFallback />}>
                    {viewMode === 'movements' && (
                        <div className="pt-2">
                            <TreasuryMovementsClientView externalOpen={modal === 'new'} />
                        </div>
                    )}

                    {viewMode === 'accounts' && (
                        <div className="pt-2">
                            <TreasuryAccountsView activeTab={subView} externalOpen={modal === 'new'} />
                        </div>
                    )}

                    {viewMode === 'reconciliation' && (
                        <div className="pt-2">
                            {subView === 'statements' && <StatementsList externalOpen={modal === 'import'} />}
                            {subView === 'dashboard' && <ReconciliationDashboard />}
                            {subView === 'rules' && <ReconciliationRules externalOpen={modal === 'new-rule'} />}
                        </div>
                    )}
                </Suspense>
            </div>

            <SettingsSheetRouteWrapper
                sheetId="treasury-settings"
                title="Configuración de Tesorería"
                description="Gestione las cuentas de ajuste para conciliación bancaria y movimientos de caja."
                tabLabel="Configuración"
                fullWidth={600}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <TreasurySettingsView />
                </Suspense>
            </SettingsSheetRouteWrapper>
        </div>
    )
}
