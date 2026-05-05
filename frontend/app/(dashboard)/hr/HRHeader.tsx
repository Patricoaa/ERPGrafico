"use client"

import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"

export function HRHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    
    // Determine active view from pathname
    // e.g. /hr/employees -> employees
    // /hr/settings -> config
    const segments = pathname.split('/').filter(Boolean)
    // segments[0] is 'hr'
    const currentSegment = segments[1] || 'employees' 
    
    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment
    const subActiveValue = currentSegment === 'settings' ? (searchParams.get('tab') || 'global') : undefined

    const tabs = [
        { value: "employees", label: "Nómina Personal", iconName: "users-2", href: "/hr/employees" },
        { value: "absences", label: "Inasistencias", iconName: "calendar-off", href: "/hr/absences" },
        { value: "advances", label: "Anticipos", iconName: "hand-coins", href: "/hr/advances" },
        { value: "payrolls", label: "Liquidaciones", iconName: "file-spreadsheet", href: "/hr/payrolls" },
        { 
            value: "config", 
            label: "Config", 
            iconName: "settings", 
            href: "/hr/settings",
            subTabs: [
                { value: "global", label: "Globales", href: "/hr/settings?tab=global", iconName: "settings-2" },
                { value: "concepts", label: "Conceptos", href: "/hr/settings?tab=concepts", iconName: "alert-circle" },
                { value: "previsional", label: "Previsión", href: "/hr/settings?tab=previsional", iconName: "loader-2" }
            ]
        },
    ]

    const navigation = {
        moduleName: "Recursos Humanos",
        moduleHref: "/hr",
        tabs,
        activeValue,
        subActiveValue,
        configHref: "/hr/settings"
    }

    const getHeaderConfig = () => {
        switch (activeValue) {
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

    const headerChildren = activeValue === 'payrolls' ? (
        <Link href="/hr/payrolls?action=generate_drafts">
            <Button variant="outline" size="sm" className="h-9">
                <FileText className="mr-2 h-4 w-4" /> Generar Borradores
            </Button>
        </Link>
    ) : null

    return (
        <PageHeader 
            title={config.title} 
            description={config.description} 
            iconName={config.icon} 
            variant="minimal" 
            navigation={navigation}
        >
            {headerChildren}
        </PageHeader>
    )
}
