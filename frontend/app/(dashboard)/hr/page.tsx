import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { Tabs } from "@/components/ui/tabs"

// Lazy load feature components from current pages
const EmployeesView = lazy(() => import("@/app/(dashboard)/hr/employees/page").then(m => ({ default: m.default })))
const AbsencesView = lazy(() => import("@/app/(dashboard)/hr/absences/page").then(m => ({ default: m.default })))
const AdvancesView = lazy(() => import("@/app/(dashboard)/hr/advances/page").then(m => ({ default: m.default })))
const PayrollsView = lazy(() => import("@/app/(dashboard)/hr/payrolls/page").then(m => ({ default: m.default })))
const HRSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.HRSettingsView })))
import { SettingsSheetRouteWrapper } from "@/components/shared"
import { Settings2 } from "lucide-react"

export const metadata: Metadata = {
    title: "Módulo de Recursos Humanos (RRHH) | ERPGrafico",
    description: "Gestión centralizada de personal, inasistencias, anticipos y liquidaciones.",
}

interface PageProps {
    searchParams: Promise<{ view?: string; tab?: string }>
}

export default async function HRPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams
    const configTab = tab || "global"
    const viewMode = (view as 'employees' | 'absences' | 'advances' | 'payrolls') || 'employees'

    const tabs = [
        { value: "employees", label: "Nómina Personal", iconName: "users-2", href: "/hr?view=employees" },
        { value: "absences", label: "Inasistencias", iconName: "calendar-off", href: "/hr?view=absences" },
        { value: "advances", label: "Anticipos", iconName: "hand-coins", href: "/hr?view=advances" },
        { value: "payrolls", label: "Liquidaciones", iconName: "file-spreadsheet", href: "/hr?view=payrolls" },
    ]

    const getHeaderConfig = () => {
        switch (viewMode) {
            case 'employees':
                return { title: "Nómina de Personal", description: "Gestión de fichas de empleados y cargos.", icon: "users-2" }
            case 'absences':
                return { title: "Inasistencias y Licencias", description: "Control de ausencias, permisos y licencias médicas.", icon: "calendar-off" }
            case 'advances':
                return { title: "Anticipos de Sueldo", description: "Gestión de adelantos y préstamos de personal.", icon: "hand-coins" }
            case 'payrolls':
                return { title: "Liquidaciones y Remuneraciones", description: "Cálculo de haberes, descuentos y generación de pagos.", icon: "file-spreadsheet" }
            default:
                return { title: "RRHH", description: "", icon: "users-2" }
        }
    }

    const config = getHeaderConfig()

    const getTitleActions = () => {
        switch (viewMode) {
            case 'employees':
                return (
                    <PageHeaderButton
                        href="/hr?view=employees&modal=new"
                        iconName="plus"
                        circular
                        title="Nuevo Empleado"
                    />
                )
            case 'absences':
                return (
                    <PageHeaderButton
                        href="/hr?view=absences&modal=new"
                        iconName="plus"
                        circular
                        title="Nueva Inasistencia"
                    />
                )
            case 'advances':
                return (
                    <PageHeaderButton
                        href="/hr?view=advances&modal=new"
                        iconName="plus"
                        circular
                        title="Nuevo Anticipo"
                    />
                )
            case 'payrolls':
                return (
                    <div className="flex items-center gap-2">
                        <PageHeaderButton
                            href="/hr?view=payrolls&action=generate_drafts"
                            iconName="file-text"
                            variant="outline"
                            label="Generar Borradores"
                        />
                        <PageHeaderButton
                            href="/hr?view=payrolls&modal=new"
                            iconName="plus"
                            circular
                            title="Generar Liquidaciones"
                        />
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={config.title}
                description={config.description}
                iconName={config.icon as any}
                variant="minimal"
                configHref="?config=true"
                titleActions={getTitleActions()}
            />

            <PageTabs tabs={tabs} activeValue={viewMode} />

            <div className="pt-2">
                <Suspense fallback={<LoadingFallback />}>
                    {viewMode === 'employees' && <EmployeesView />}
                    {viewMode === 'absences' && <AbsencesView />}
                    {viewMode === 'advances' && <AdvancesView />}
                    {viewMode === 'payrolls' && <PayrollsView />}
                </Suspense>
            </div>

            <SettingsSheetRouteWrapper
                sheetId="hr-settings"
                title="Configuración de RRHH"
                description="Gestione indicadores económicos, conceptos de nómina e instituciones previsionales."
                tabLabel="Configuración"
                fullWidth={800}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <HRSettingsView activeTab={configTab} />
                </Suspense>
            </SettingsSheetRouteWrapper>
        </div>
    )
}
