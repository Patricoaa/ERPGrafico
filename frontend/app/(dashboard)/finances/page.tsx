import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

// Lazy load feature components
const StatementsView = lazy(() => import("@/app/(dashboard)/finances/statements/page").then(m => ({ default: m.default })))
const AnalysisView = lazy(() => import("@/app/(dashboard)/finances/analysis/page").then(m => ({ default: m.default })))
const BudgetsView = lazy(() => import("@/app/(dashboard)/finances/budgets/page").then(m => ({ default: m.default })))

export const metadata: Metadata = {
    title: "Módulo de Finanzas | ERPGrafico",
    description: "Análisis financiero, estados de resultados, balances y presupuestos.",
}

interface PageProps {
    searchParams: Promise<{ view?: string; modal?: string; tab?: string }>
}

export default async function FinancesPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams
    const viewMode = (view as 'statements' | 'analysis' | 'budgets') || 'statements'

    const tabs = [
        { 
            value: "statements", 
            label: "Estados Financieros", 
            iconName: "clipboard-list", 
            href: "/finances?view=statements",
            subTabs: [
                { value: "bs", label: "Balance", iconName: "file-text", href: "/finances?view=statements&tab=bs" },
                { value: "pl", label: "Resultados", iconName: "bar-chart-2", href: "/finances?view=statements&tab=pl" },
                { value: "cf", label: "Flujos", iconName: "trending-up", href: "/finances?view=statements&tab=cf" },
            ]
        },
        { 
            value: "analysis", 
            label: "Análisis", 
            iconName: "line-chart", 
            href: "/finances?view=analysis",
            subTabs: [
                { value: "ratios", label: "Ratios Financieros", iconName: "pie-chart", href: "/finances?view=analysis&tab=ratios" },
                { value: "bi", label: "Business Intelligence", iconName: "activity", href: "/finances?view=analysis&tab=bi" },
            ]
        },
        { 
            value: "budgets", 
            label: "Presupuestos", 
            iconName: "target", 
            href: "/finances?view=budgets",
            subTabs: [
                { value: "list", label: "Gestión", iconName: "list", href: "/finances?view=budgets&tab=list" },
                { value: "versus", label: "Versus", iconName: "chart-bar", href: "/finances?view=budgets&tab=versus" },
            ]
        },
    ]

    const getHeaderConfig = () => {
        switch (viewMode) {
            case 'statements':
                if (tab === 'bs') {
                    return { title: "Balance General", description: "Estado de situación financiera resumido.", icon: "file-text", action: null }
                } else if (tab === 'pl') {
                    return { title: "Estado de Resultados", description: "Pérdidas y ganancias en un periodo determinado.", icon: "bar-chart-2", action: null }
                } else if (tab === 'cf') {
                    return { title: "Flujo de Caja", description: "Análisis de entradas y salidas de efectivo.", icon: "trending-up", action: null }
                } else {
                    return { title: "Estados Financieros", description: "Reportes oficiales de Balance, P&L y Flujo de Caja.", icon: "clipboard-list", action: null }
                }
            case 'analysis':
                if (tab === 'bi') {
                    return { title: "Business Intelligence", description: "Análisis visual de métricas de rentabilidad y evolución.", icon: "activity", action: null }
                } else if (tab === 'ratios') {
                    return { title: "Ratios Financieros", description: "Métricas de liquidez, solvencia y rentabilidad.", icon: "pie-chart", action: null }
                } else {
                    return { title: "Análisis Financiero", description: "Visualización de ratios, KPIs e inteligencia de negocio.", icon: "line-chart", action: null }
                }
            case 'budgets':
                if (tab === 'versus') {
                    return { title: "Versus Presupuestario", description: "Análisis de variaciones mes y acumulado.", icon: "chart-bar", action: null }
                }
                return { 
                    title: "Control Presupuestario", 
                    description: "Gestión de metas presupuestarias y ejecución.", 
                    icon: "target",
                    action: (
                        <PageHeaderButton
                            href="/finances?view=budgets&modal=new"
                            iconName="plus"
                            circular
                            title="Nuevo Presupuesto"
                        />
                    )
                }
            default:
                return { title: "Finanzas", description: "", icon: "trending-up", action: null }
        }
    }

    const { modal } = await searchParams
    const config = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={config.title}
                description={config.description}
                iconName={config.icon as any}
                variant="minimal"
                titleActions={config.action}
            />

            <PageTabs tabs={tabs} activeValue={viewMode} subActiveValue={tab} />

            <div className="pt-2">
                <Suspense fallback={<LoadingFallback />}>
                    {viewMode === 'statements' && <StatementsView searchParams={Promise.resolve({ tab })} />}
                    {viewMode === 'analysis' && <AnalysisView searchParams={Promise.resolve({ tab })} />}
                    {viewMode === 'budgets' && <BudgetsView externalOpen={modal === 'new'} tab={tab} />}
                </Suspense>
            </div>
        </div>
    )
}
