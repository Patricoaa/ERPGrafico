"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"

export function AccountingHeader() {
    const pathname = usePathname()

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
    const subActiveValue = currentSegment === 'settings' ? (segments[2] || 'structure') : undefined

    const tabs = [
        { value: "ledger", label: "Plan de Cuentas", iconName: getEntityIconName('accounting.account'), href: "/accounting/ledger" },
        { value: "entries", label: "Asientos", iconName: getEntityIconName('accounting.journalentry'), href: "/accounting/entries" },
        { value: "closures", label: "Cierre Contable", iconName: getEntityIconName('accounting.fiscalyear'), href: "/accounting/closures" },
        { value: "tax", label: "Impuestos mensuales (F29)", iconName: "landmark", href: "/accounting/tax" },
        {
            value: "config",
            label: "Configuración",
            iconName: "settings",
            href: "/accounting/settings",
            subTabs: [
                { value: "structure", label: "Estructura Contable", href: "/accounting/settings/structure", iconName: "settings-2" },
                { value: "accounts", label: "Cuentas Contables", href: "/accounting/settings/accounts", iconName: "book-open" },
            ]
        },
    ]

    const navigation = {
        moduleName: "Contabilidad",
        moduleHref: "/accounting",
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración Contable", description: "Gestione la estructura del plan de cuentas y las cuentas contables por defecto.", iconName: "settings" as const }
        if (activeValue === 'ledger') return { title: "Plan de Cuentas", description: "Estructura contable y clasificación de cuentas.", iconName: getEntityIconName('accounting.account') }
        if (activeValue === 'entries') return { title: "Asientos Contables", description: "Libro diario y registro cronológico de transacciones.", iconName: getEntityIconName('accounting.journalentry') }
        if (activeValue === 'closures') return { title: "Gestión de Cierres", description: "Control de validación mensual y cierres de ejercicios anuales.", iconName: getEntityIconName('accounting.fiscalyear') }
        if (activeValue === 'tax') return { title: "Cumplimiento Tributario", description: "Declaraciones F29 y gestión de periodos fiscales.", iconName: getEntityIconName('accounting.account') ?? "calculator" }
        return { title: "Contabilidad", description: "", iconName: getEntityIconName('accounting.account') ?? "calculator" }
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
