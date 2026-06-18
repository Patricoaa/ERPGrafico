"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"

export function AccountingHeader() {
    const pathname = usePathname()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'ledger'

    const activeValue = currentSegment === 'settings' ? 'ledger' : currentSegment
    const subActiveValue = undefined

    const tabs = [
        { value: "ledger", label: "Plan de Cuentas", iconName: getEntityIconName('accounting.account'), href: "/accounting/ledger" },
        { value: "entries", label: "Asientos", iconName: getEntityIconName('accounting.journalentry'), href: "/accounting/entries" },
        { value: "closures", label: "Cierre Contable", iconName: getEntityIconName('accounting.fiscalyear'), href: "/accounting/closures" },
        { value: "tax", label: "Impuestos mensuales (F29)", iconName: "landmark", href: "/accounting/tax" },
    ]

    const navigation = {
        moduleName: "Contabilidad",
        moduleHref: "/accounting",
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
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
