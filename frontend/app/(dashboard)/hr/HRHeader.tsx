"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"
import { useViewModePreference } from "@/hooks/useViewModePreference"

export function HRHeader() {
    const pathname = usePathname()
    const { getViewModeUrl } = useViewModePreference()
    
    // Determine active view from pathname
    // e.g. /hr/employees -> employees
    // /hr/settings -> config
    const segments = pathname.split('/').filter(Boolean)
    // segments[0] is 'hr'
    const currentSegment = segments[1] || 'employees' 
    
    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment
    const subActiveValue = currentSegment === 'settings' ? (segments[2] || 'global') : undefined

    const tabs = [
        { value: "employees", label: "Nómina Personal", iconName: getEntityIconName('hr.employee'), href: getViewModeUrl('hr.employee', "/hr/employees") },
        { value: "absences", label: "Inasistencias", iconName: getEntityIconName('hr.absence'), href: getViewModeUrl('hr.absence', "/hr/absences") },
        { value: "advances", label: "Anticipos", iconName: getEntityIconName('hr.salaryadvance'), href: getViewModeUrl('hr.salaryadvance', "/hr/advances") },
        { value: "payrolls", label: "Liquidaciones", iconName: getEntityIconName('hr.payroll'), href: getViewModeUrl('hr.payroll', "/hr/payrolls") },
        { 
            value: "config", 
            label: "Configuración", 
            iconName: "settings", 
            href: "/hr/settings",
            subTabs: [
                { value: "global", label: "Globales", href: "/hr/settings/global", iconName: "settings-2" },
                { value: "concepts", label: "Conceptos", href: "/hr/settings/concepts", iconName: "alert-circle" },
                { value: "previsional", label: "Previsión", href: "/hr/settings/previsional", iconName: "loader-2" }
            ]
        },
    ]

    const navigation = {
        moduleName: "Recursos Humanos",
        moduleHref: getViewModeUrl('hr.employee', "/hr/employees"),
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        switch (activeValue) {
            case 'config':
                return { title: "Configuración de RRHH", description: "Gestione indicadores económicos, conceptos de nómina e instituciones previsionales.", iconName: "settings" }
            case 'employees':
                return { title: "Nómina de Personal", description: "Gestión de fichas de empleados y cargos.", iconName: "users-2" }
            case 'absences':
                return { title: "Inasistencias y Licencias", description: "Control de ausencias, permisos y licencias médicas.", iconName: "calendar-off" }
            case 'advances':
                return { title: "Anticipos de Sueldo", description: "Gestión de adelantos y préstamos de personal.", iconName: "hand-coins" }
            case 'payrolls':
                return { title: "Liquidaciones y Remuneraciones", description: "Cálculo de haberes, descuentos y generación de pagos.", iconName: "file-spreadsheet" }
            default:
                return { title: "RRHH", description: "", iconName: getEntityIconName('hr.employee') ?? "user-cog" }
        }
    }

    const config = getHeaderConfig()

    return (
        <PageHeader 
            title={config.title} 
            description={config.description} 
            iconName={config.iconName} 
            variant="minimal" 
            navigation={navigation}
        />
    )
}
