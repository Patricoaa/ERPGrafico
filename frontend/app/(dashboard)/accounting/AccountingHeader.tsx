"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function AccountingHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'ledger'

    const segmentToTab: Record<string, string> = {
        ledger: 'ledger',
        entries: 'entries',
        closures: 'closures',
        tax: 'tax',
        settings: 'config',
    }

    const activeValue = segmentToTab[currentSegment] || 'ledger'
    const subActiveValue = searchParams.get('tab')

    const tabs = [
        { value: "ledger", label: "Plan de Cuentas", iconName: "list-tree", href: "/accounting/ledger" },
        { value: "entries", label: "Asientos", iconName: "file-text", href: "/accounting/entries" },
        { value: "closures", label: "Cierre Contable", iconName: "calendar", href: "/accounting/closures" },
        { value: "tax", label: "Impuestos mensuales (F29)", iconName: "landmark", href: "/accounting/tax" },
        {
            value: "config",
            label: "Config",
            iconName: "settings",
            href: "/accounting/settings",
            subTabs: [
                { value: "structure", label: "Estructura Contable", href: "/accounting/settings?tab=structure", iconName: "settings-2" },
                { value: "defaults", label: "Cuentas por Defecto", href: "/accounting/settings?tab=defaults", iconName: "book-open" },
                { value: "tax", label: "Impuestos", href: "/accounting/settings?tab=tax", iconName: "receipt" }
            ]
        },
    ]

    const navigation = {
        moduleName: "Contabilidad",
        moduleHref: "/accounting",
        tabs,
        activeValue,
        subActiveValue,
        configHref: "/accounting/settings"
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración Contable", description: "Gestione la estructura del plan de cuentas, prefijos y reglas de negocio.", iconName: "settings" as const }
        if (activeValue === 'ledger') return { title: "Plan de Cuentas", description: "Estructura contable y clasificación de cuentas.", iconName: "list-tree" as const }
        if (activeValue === 'entries') return { title: "Asientos Contables", description: "Libro diario y registro cronológico de transacciones.", iconName: "file-text" as const }
        if (activeValue === 'closures') return { title: "Gestión de Cierres", description: "Control de validación mensual y cierres de ejercicios anuales.", iconName: "calendar" as const }
        if (activeValue === 'tax') return { title: "Cumplimiento Tributario", description: "Declaraciones F29 y gestión de periodos fiscales.", iconName: "calculator" as const }
        return { title: "Contabilidad", description: "", iconName: "calculator" as const }
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
