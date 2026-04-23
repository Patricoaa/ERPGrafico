import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { TableSkeleton, PageHeader, PageTabs, PageHeaderButton } from "@/components/shared"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { LAYOUT_TOKENS } from "@/lib/styles"

// Lazy load feature components
const AccountsView = lazy(() => import("@/features/accounting").then(m => ({ default: m.AccountsClientView })))
const EntriesView = lazy(() => import("@/app/(dashboard)/accounting/entries/page").then(m => ({ default: m.default })))
const ClosuresView = lazy(() => import("@/features/accounting").then(m => ({ default: m.AccountingClosuresView })))
const TrialBalanceView = lazy(() => import("@/features/accounting").then(m => ({ default: m.TrialBalanceView })))
const TaxDeclarationsView = lazy(() => import("@/features/tax").then(m => ({ default: m.TaxDeclarationsView })))
const AccountingSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.AccountingSettingsView })))

export const metadata: Metadata = {
    title: "Módulo Contable | ERPGrafico",
    description: "Gestión centralizada del plan de cuentas, asientos, periodos y cumplimiento tributario.",
}

interface PageProps {
    searchParams: Promise<{ view?: string; modal?: string; tab?: string }>
}

export default async function AccountingPage({ searchParams }: PageProps) {
    const { view, modal, tab } = await searchParams
    const configTab = tab || "global"
    const viewMode = (view as 'ledger' | 'entries' | 'closures' | 'tax' | 'trial-balance' | 'config') || 'ledger'

    const tabs = [
        { value: "ledger", label: "Plan de Cuentas", iconName: "list-tree", href: "/accounting?view=ledger" },
        { value: "entries", label: "Asientos", iconName: "file-text", href: "/accounting?view=entries" },
        { value: "closures", label: "Cierre Contable", iconName: "calendar", href: "/accounting?view=closures" },
        { value: "tax", label: "Impuestos mensuales (F29)", iconName: "landmark", href: "/accounting?view=tax" },
        { value: "config", label: "Config", iconName: "settings", href: "/accounting?view=config" },
    ]

    const getHeaderConfig = () => {
        switch (viewMode) {
            case 'config':
                return { title: "Configuración Contable", description: "Gestione la estructura del plan de cuentas, prefijos y reglas de negocio.", icon: "settings", createActionTitle: null, createActionHref: null, titleAction: null }
            case 'ledger':
                return { title: "Plan de Cuentas", description: "Estructura contable y clasificación de cuentas.", icon: "list-tree", createActionTitle: "Nueva Cuenta", createActionHref: "/accounting?view=ledger&modal=new", titleAction: null }
            case 'entries':
                return { title: "Asientos Contables", description: "Libro diario y registro cronológico de transacciones.", icon: "file-text", createActionTitle: "Nuevo Asiento", createActionHref: "/accounting?view=entries&modal=new", titleAction: null }
            case 'trial-balance':
                return { title: "Balance de Comprobación", description: "Sumas y saldos del libro mayor para validar la integridad contable.", icon: "calculator", createActionTitle: null, createActionHref: null, titleAction: <PageHeaderButton iconName="download" title="Exportar Reporte" /> }
            case 'closures':
                return { title: "Gestión de Cierres", description: "Control de validación mensual y cierres de ejercicios anuales.", icon: "calendar", createActionTitle: null, createActionHref: null, titleAction: <PageHeaderButton href="/accounting?view=closures&modal=fy" iconName="plus" circular title="Nuevo Año Fiscal" /> }
            case 'tax':
                return { title: "Cumplimiento Tributario", description: "Declaraciones F29 y gestión de periodos fiscales.", icon: "calculator", createActionTitle: "Nueva Declaración", createActionHref: "/accounting?view=tax&modal=new", titleAction: null }
            default:
                return { title: "Contabilidad", description: "", icon: "calculator", createActionTitle: null, createActionHref: null, titleAction: null }
        }
    }

    const config = getHeaderConfig()
    const createAction = config.createActionTitle && config.createActionHref ? (
        <ToolbarCreateButton label={config.createActionTitle} href={config.createActionHref} />
    ) : null

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader title={config.title} description={config.description} iconName={config.icon} variant="minimal" titleActions={config.titleAction} />
            <PageTabs tabs={tabs} activeValue={viewMode} />

            <div className="pt-2">
                <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                    {viewMode === 'ledger' && <AccountsView externalOpen={modal === 'new'} createAction={createAction} />}
                    {viewMode === 'entries' && <EntriesView externalOpen={modal === 'new'} createAction={createAction} />}
                    {viewMode === 'closures' && <ClosuresView externalOpen={modal === 'fy'} />}
                    {viewMode === 'trial-balance' && <TrialBalanceView />}
                    {viewMode === 'tax' && <TaxDeclarationsView externalOpen={modal === 'new'} createAction={createAction} />}
                    {viewMode === 'config' && <AccountingSettingsView />}
                </Suspense>
            </div>
        </div>
    )
}
