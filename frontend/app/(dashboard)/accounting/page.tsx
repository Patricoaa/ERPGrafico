import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

// Lazy load feature components
const AccountsView = lazy(() => import("@/app/(dashboard)/accounting/accounts/page").then(m => ({ default: m.default })))
const EntriesView = lazy(() => import("@/app/(dashboard)/accounting/entries/page").then(m => ({ default: m.default })))
const PeriodsView = lazy(() => import("@/app/(dashboard)/accounting/periods/page").then(m => ({ default: m.default })))
const TaxDeclarationsView = lazy(() => import("@/app/(dashboard)/tax/declarations/page").then(m => ({ default: m.default })))
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
    const viewMode = (view as 'ledger' | 'entries' | 'periods' | 'tax') || 'ledger'

    const tabs = [
        { value: "ledger", label: "Plan de Cuentas", iconName: "list-tree", href: "/accounting?view=ledger" },
        { value: "entries", label: "Asientos", iconName: "file-text", href: "/accounting?view=entries" },
        { value: "periods", label: "Periodos", iconName: "calendar", href: "/accounting?view=periods" },
        { value: "tax", label: "Impuestos (F29)", iconName: "calculator", href: "/accounting?view=tax" },
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
            case 'periods':
                return {
                    title: "Gestión de Periodos",
                    description: "Control de cierres mensuales y apertura de ejercicios.",
                    icon: "calendar",
                    action: null
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
                    {viewMode === 'periods' && <PeriodsView />}
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
