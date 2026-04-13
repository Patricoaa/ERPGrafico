import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

// Lazy load feature components
const AccountsView = lazy(() => import("@/features/accounting/components/AccountsClientView").then(m => ({ default: m.AccountsClientView })))
const EntriesView = lazy(() => import("@/app/(dashboard)/accounting/entries/page").then(m => ({ default: m.default })))
const ClosuresView = lazy(() => import("@/features/accounting/components").then(m => ({ default: m.AccountingClosuresView })))
const TrialBalanceView = lazy(() => import("@/features/accounting/components").then(m => ({ default: m.TrialBalanceView })))
const TaxDeclarationsView = lazy(() => import("@/features/tax/components/TaxDeclarationsView").then(m => ({ default: m.TaxDeclarationsView })))
const AccountingSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.AccountingSettingsView })))
import { SettingsSheetRouteWrapper } from "@/components/shared"
import { Settings2 } from "lucide-react"

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
    const viewMode = (view as 'ledger' | 'entries' | 'closures' | 'tax' | 'trial-balance') || 'ledger'

    const tabs = [
        { value: "ledger", label: "Plan de Cuentas", iconName: "list-tree", href: "/accounting?view=ledger" },
        { value: "entries", label: "Asientos", iconName: "file-text", href: "/accounting?view=entries" },
        { value: "closures", label: "Cierre Contable", iconName: "calendar", href: "/accounting?view=closures" },
        { value: "tax", label: "Impuestos mensuales (F29)", iconName: "landmark", href: "/accounting?view=tax" },
    ]

    const getHeaderConfig = () => {
        switch (viewMode) {
            case 'ledger':
                return {
                    title: "Plan de Cuentas",
                    description: "Estructura contable y clasificación de cuentas.",
                    icon: "list-tree",
                    action: (
                        <PageHeaderButton
                            href="/accounting?view=ledger&modal=new"
                            iconName="plus"
                            circular
                            title="Nueva Cuenta"
                        />
                    )
                }
            case 'entries':
                return {
                    title: "Asientos Contables",
                    description: "Libro diario y registro cronológico de transacciones.",
                    icon: "file-text",
                    action: (
                        <PageHeaderButton
                            href="/accounting?view=entries&modal=new"
                            iconName="plus"
                            circular
                            title="Nuevo Asiento"
                        />
                    )
                }
            case 'trial-balance':
                return {
                    title: "Balance de Comprobación",
                    description: "Sumas y saldos del libro mayor para validar la integridad contable.",
                    icon: "calculator",
                    action: <PageHeaderButton iconName="download" title="Exportar Reporte" />
                }
            case 'closures':
                return {
                    title: "Gestión de Cierres",
                    description: "Control de validación mensual y cierres de ejercicios anuales.",
                    icon: "calendar",
                    action: <PageHeaderButton href="/accounting?view=closures&modal=fy" iconName="plus" circular title="Nuevo Año Fiscal" />
                }
            case 'tax':
                return {
                    title: "Cumplimiento Tributario",
                    description: "Declaraciones F29 y gestión de periodos fiscales.",
                    icon: "calculator",
                    action: (
                        <PageHeaderButton
                            href="/accounting?view=tax&modal=new"
                            iconName="plus"
                            circular
                            title="Nueva Declaración"
                        />
                    )
                }
            default:
                return { title: "Contabilidad", description: "", icon: "calculator", action: null }
        }
    }

    const config = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={config.title}
                description={config.description}
                iconName={config.icon as any}
                variant="minimal"
                configHref="?config=true"
                titleActions={config.action}
            />

            <PageTabs tabs={tabs} activeValue={viewMode} />

            <div className="pt-2">
                <Suspense fallback={<LoadingFallback />}>
                    {viewMode === 'ledger' && <AccountsView externalOpen={modal === 'new'} />}
                    {viewMode === 'entries' && <EntriesView externalOpen={modal === 'new'} />}
                    {viewMode === 'closures' && <ClosuresView externalOpen={modal === 'fy'} />}
                    {viewMode === 'trial-balance' && <TrialBalanceView />}
                    {viewMode === 'tax' && <TaxDeclarationsView externalOpen={modal === 'new'} />}
                </Suspense>
            </div>

            <SettingsSheetRouteWrapper
                sheetId="accounting-settings"
                title="Configuración Contable"
                description="Gestione la estructura del plan de cuentas, prefijos y reglas de negocio."
                tabLabel="Configuración"
            >
                <Suspense fallback={<LoadingFallback />}>
                    <AccountingSettingsView />
                </Suspense>
            </SettingsSheetRouteWrapper>
        </div>
    )
}
