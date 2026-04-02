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
        { value: "accounts", label: "Cuentas y Caja", iconName: "landmark", href: "/treasury?view=accounts" },
        { value: "reconciliation", label: "Conciliación", iconName: "history", href: "/treasury?view=reconciliation" },
    ]

    const getHeaderConfig = () => {
        if (viewMode === 'movements') {
            return {
                title: "Movimientos de Tesorería",
                description: "Registro histórico de ingresos, egresos y traslados de fondos.",
                actionTitle: "Nuevo Movimiento",
                actionHref: "/treasury?view=movements&modal=new",
                actionIcon: "plus",
                showAction: true
            }
        }
        if (viewMode === 'accounts') {
            const labels: Record<string, string> = { accounts: 'Cuenta', banks: 'Banco', methods: 'Método' }
            return {
                title: "Gestión de Cuentas",
                description: "Administre sus cuentas bancarias, entidades y métodos de pago.",
                actionTitle: `Nuevo ${labels[subView] || "Registro"}`,
                actionHref: `/treasury?view=accounts&sub=${subView}&modal=new`,
                actionIcon: "plus",
                showAction: true
            }
        }
        if (viewMode === 'reconciliation') {
            return {
                title: "Conciliación Bancaria",
                description: "Gestión de cartolas y cuadratura de movimientos bancarios.",
                actionTitle: subView === 'statements' ? "Importar Cartola" : subView === 'rules' ? "Nueva Regla" : "",
                actionHref: `/treasury?view=reconciliation&sub=${subView}&modal=${subView === 'statements' ? 'import' : 'new-rule'}`,
                actionIcon: subView === 'statements' ? "upload" : "plus",
                showAction: subView !== 'dashboard'
            }
        }
        return { title: "Tesorería", description: "", showAction: false }
    }

    const config = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={config.title}
                description={config.description}
                iconName={viewMode === 'movements' ? "banknote" : viewMode === 'accounts' ? "landmark" : "history"}
                variant="minimal"
                configHref="/settings/treasury"
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

            <PageTabs tabs={tabs} activeValue={viewMode} />

            <div className="pt-4">
                <Suspense fallback={<LoadingFallback />}>
                    {viewMode === 'movements' && (
                        <div className="pt-2">
                            <TreasuryMovementsClientView externalOpen={modal === 'new'} />
                        </div>
                    )}

                    {viewMode === 'accounts' && (
                        <div className="space-y-4">
                            <PageTabs 
                                tabs={[
                                    { value: "accounts", label: "Cuentas", href: "/treasury?view=accounts&sub=accounts" },
                                    { value: "banks", label: "Bancos", href: "/treasury?view=accounts&sub=banks" },
                                    { value: "methods", label: "Métodos", href: "/treasury?view=accounts&sub=methods" },
                                ]} 
                                activeValue={subView} 
                                variant="minimal"
                            />
                            <div className="pt-2">
                                <TreasuryAccountsView activeTab={subView} externalOpen={modal === 'new'} />
                            </div>
                        </div>
                    )}

                    {viewMode === 'reconciliation' && (
                        <div className="space-y-4">
                            <PageTabs 
                                tabs={[
                                    { value: "statements", label: "Cartolas", iconName: "file-text", href: "/treasury?view=reconciliation&sub=statements" },
                                    { value: "dashboard", label: "Dashboard", iconName: "bar-chart-3", href: "/treasury?view=reconciliation&sub=dashboard" },
                                    { value: "rules", label: "Reglas", iconName: "wand-2", href: "/treasury?view=reconciliation&sub=rules" },
                                ]} 
                                activeValue={subView} 
                                variant="minimal"
                            />
                            <div className="pt-2">
                                {subView === 'statements' && <StatementsList externalOpen={modal === 'import'} />}
                                {subView === 'dashboard' && <ReconciliationDashboard />}
                                {subView === 'rules' && <ReconciliationRules externalOpen={modal === 'new-rule'} />}
                            </div>
                        </div>
                    )}
                </Suspense>
            </div>
        </div>
    )
}
