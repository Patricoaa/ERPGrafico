"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function TreasuryHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'movements'

    // Map physical routes to tab values
    const segmentToTab: Record<string, string> = {
        movements: 'movements',
        accounts: 'accounts',
        reconciliation: 'reconciliation',
        'terminal-batches': 'reconciliation', // batches lives under reconciliation tab
        settings: 'config',
    }

    const activeValue = segmentToTab[currentSegment] || 'movements'

    const tabParam = searchParams.get('tab')

    // Determine subActiveValue
    const subActiveValue = (() => {
        if (activeValue === 'config') return tabParam || 'conciliation'
        if (activeValue === 'accounts') return tabParam || 'accounts'
        if (activeValue === 'reconciliation') {
            if (currentSegment === 'terminal-batches') return 'terminal-batches'
            return tabParam || 'statements'
        }
        return undefined
    })()

    const tabs = [
        { value: "movements", label: "Movimientos", iconName: "banknote", href: "/treasury/movements" },
        {
            value: "accounts",
            label: "Cuentas y Caja",
            iconName: "landmark",
            href: "/treasury/accounts",
            subTabs: [
                { value: "accounts", label: "Cuentas", href: "/treasury/accounts?tab=accounts", iconName: "list" },
                { value: "banks", label: "Bancos", href: "/treasury/accounts?tab=banks", iconName: "landmark" },
                { value: "methods", label: "Métodos", href: "/treasury/accounts?tab=methods", iconName: "credit-card" },
            ]
        },
        {
            value: "reconciliation",
            label: "Conciliación",
            iconName: "history",
            href: "/treasury/reconciliation",
            subTabs: [
                { value: "statements", label: "Cartolas", iconName: "file-text", href: "/treasury/reconciliation?tab=statements" },
                { value: "dashboard", label: "Dashboard", iconName: "bar-chart-3", href: "/treasury/reconciliation?tab=dashboard" },
                { value: "intelligence", label: "Inteligencia", iconName: "brain", href: "/treasury/reconciliation?tab=intelligence" },
                { value: "terminal-batches", label: "Lotes Terminal", iconName: "credit-card", href: "/treasury/terminal-batches" },
            ]
        },
        {
            value: "config",
            label: "Config",
            iconName: "settings",
            href: "/treasury/settings",
            subTabs: [
                { value: "conciliation", label: "Conciliación", href: "/treasury/settings?tab=conciliation", iconName: "arrow-left-right" },
                { value: "audit", label: "Arqueo", href: "/treasury/settings?tab=audit", iconName: "banknote" },
                { value: "movements", label: "Movimientos", href: "/treasury/settings?tab=movements", iconName: "settings-2" },
            ]
        },
    ]

    const navigation = {
        moduleName: "Tesorería",
        moduleHref: "/treasury",
        tabs,
        activeValue,
        subActiveValue,
        configHref: "/treasury/settings"
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración de Tesorería", description: "Gestione las cuentas de ajuste para conciliación bancaria y movimientos de caja.", iconName: "settings" as const }
        if (activeValue === 'movements') return { title: "Movimientos de Tesorería", description: "Registro histórico de ingresos, egresos y traslados de fondos.", iconName: "banknote" as const }
        if (activeValue === 'accounts') {
            if (subActiveValue === 'banks') return { title: "Gestión de Bancos", description: "Administre las entidades bancarias globales del sistema.", iconName: "landmark" as const }
            if (subActiveValue === 'methods') return { title: "Métodos de Pago", description: "Configure los medios de pago aceptados y sus cuentas vinculadas.", iconName: "credit-card" as const }
            return { title: "Cuentas de Tesorería", description: "Registre y configure sus cuentas bancarias y de efectivo.", iconName: "landmark" as const }
        }
        if (activeValue === 'reconciliation') {
            if (subActiveValue === 'terminal-batches') return { title: "Lotes de Terminales", description: "Registre liquidaciones y comisiones de terminales de cobro.", iconName: "credit-card" as const }
            if (subActiveValue === 'dashboard') return { title: "Dashboard de Conciliación", description: "Métricas y resumen de la cuadratura contable y bancaria.", iconName: "bar-chart-3" as const }
            if (subActiveValue === 'intelligence') return { title: "Inteligencia de Conciliación", description: "Configura pesos y umbrales para el matching automático por cuenta.", iconName: "brain" as const }
            return { title: "Cartolas Bancarias", description: "Importación y gestión de cartolas para conciliación.", iconName: "file-text" as const }
        }
        return { title: "Tesorería", description: "", iconName: "banknote" as const }
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
