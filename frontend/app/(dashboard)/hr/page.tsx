import { Metadata } from "next"
import { lazy, Suspense } from "react"
import Link from "next/link"
import { PageTabs, TableSkeleton, PageHeader, ToolbarCreateButton } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import { LAYOUT_TOKENS } from "@/lib/styles"

const EmployeesView = lazy(() => import("@/app/(dashboard)/hr/employees/page").then(m => ({ default: m.default })))
const AbsencesView = lazy(() => import("@/app/(dashboard)/hr/absences/page").then(m => ({ default: m.default })))
const AdvancesView = lazy(() => import("@/app/(dashboard)/hr/advances/page").then(m => ({ default: m.default })))
const PayrollsView = lazy(() => import("@/app/(dashboard)/hr/payrolls/page").then(m => ({ default: m.default })))
const HRSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.HRSettingsView })))

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
    const viewMode = (view as 'employees' | 'absences' | 'advances' | 'payrolls' | 'config') || 'employees'

    const tabs = [
        { value: "employees", label: "Nómina Personal", iconName: "users-2", href: "/hr?view=employees" },
        { value: "absences", label: "Inasistencias", iconName: "calendar-off", href: "/hr?view=absences" },
        { value: "advances", label: "Anticipos", iconName: "hand-coins", href: "/hr?view=advances" },
        { value: "payrolls", label: "Liquidaciones", iconName: "file-spreadsheet", href: "/hr?view=payrolls" },
        { value: "config", label: "Config", iconName: "settings", href: "/hr?view=config" },
    ]

    const getHeaderConfig = () => {
        switch (viewMode) {
            case 'config':
                return { title: "Configuración de RRHH", description: "Gestione indicadores económicos, conceptos de nómina e instituciones previsionales.", icon: "settings" }
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

    const getCreateAction = () => {
        switch (viewMode) {
            case 'employees':
                return <ToolbarCreateButton label="Nuevo Empleado" href="/hr?view=employees&modal=new" />
            case 'absences':
                return <ToolbarCreateButton label="Nueva Inasistencia" href="/hr?view=absences&modal=new" />
            case 'advances':
                return <ToolbarCreateButton label="Nuevo Anticipo" href="/hr?view=advances&modal=new" />
            case 'payrolls':
                return <ToolbarCreateButton label="Generar Liquidaciones" href="/hr?view=payrolls&modal=new" />
            default:
                return null
        }
    }

    const createAction = getCreateAction()

    const headerChildren = viewMode === 'payrolls' ? (
        <Link href="/hr?view=payrolls&action=generate_drafts">
            <Button variant="outline" size="sm" className="h-9">
                <FileText className="mr-2 h-4 w-4" /> Generar Borradores
            </Button>
        </Link>
    ) : null

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader title={config.title} description={config.description} iconName={config.icon} variant="minimal">
                {headerChildren}
            </PageHeader>

            <PageTabs tabs={tabs} activeValue={viewMode} />

            <div className="pt-2">
                <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                    {viewMode === 'employees' && <EmployeesView createAction={createAction} />}
                    {viewMode === 'absences' && <AbsencesView createAction={createAction} />}
                    {viewMode === 'advances' && <AdvancesView createAction={createAction} />}
                    {viewMode === 'payrolls' && <PayrollsView createAction={createAction} />}
                    {viewMode === 'config' && <HRSettingsView activeTab={configTab} />}
                </Suspense>
            </div>
        </div>
    )
}
