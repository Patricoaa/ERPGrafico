"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getModuleIconName } from "@/lib/module-registry"

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
        'terminal-cobro': 'terminal-cobro',
        settings: 'config',
    }

    const activeValue = segmentToTab[currentSegment] || 'movements'

    const tabParam = searchParams.get('tab')

    // Determine subActiveValue
    const subActiveValue = (() => {
        if (activeValue === 'config') return tabParam || 'conciliation'
        if (activeValue === 'accounts') return tabParam || 'accounts'
        if (activeValue === 'reconciliation') return tabParam || 'statements'
        if (activeValue === 'terminal-cobro') return tabParam || 'providers'
        return undefined
    })()

    const tabs = [
        { value: "movements", label: "Movimientos", iconName: "banknote", href: "/treasury/movements" },
        {
            value: "accounts",
            label: "Cuentas y bancos",
            iconName: "landmark",
            href: "/treasury/accounts",
            subTabs: [
                { value: "accounts", label: "Cuentas", href: "/treasury/accounts?tab=accounts", iconName: "list" },
                { value: "banks", label: "Bancos", href: "/treasury/accounts?tab=banks", iconName: "landmark" },
                { value: "methods", label: "Métodos", href: "/treasury/accounts?tab=methods", iconName: "credit-card" },
            ]
        },
        {
            value: "terminal-cobro",
            label: "Terminal de Cobro",
            iconName: "cpu",
            href: "/treasury/terminal-cobro?tab=providers",
            subTabs: [
                { value: "providers", label: "Proveedores", iconName: "building2", href: "/treasury/terminal-cobro?tab=providers" },
                { value: "devices", label: "Dispositivos", iconName: "smartphone", href: "/treasury/terminal-cobro?tab=devices" },
                { value: "batches", label: "Lotes de Pago", iconName: "credit-card", href: "/treasury/terminal-cobro?tab=batches" },
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
            ]
        },
        {
            value: "config",
            label: "Configuración",
            iconName: "settings",
            href: "/treasury/settings",
            subTabs: [
                { value: "conciliation", label: "Conciliación", href: "/treasury/settings?tab=conciliation", iconName: "arrow-left-right" },
                { value: "audit", label: "Arqueo", href: "/treasury/settings?tab=audit", iconName: "banknote" },
                { value: "movements", label: "Movimientos", href: "/treasury/settings?tab=movements", iconName: "settings-2" },
                { value: "terminals", label: "Terminales", href: "/treasury/settings?tab=terminals", iconName: "smartphone" },
            ]
        },
    ]

    const navigation = {
        moduleName: "Tesorería",
        moduleHref: "/treasury",
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') {
            if (subActiveValue === 'terminals') return { title: "Cuentas Puente de Terminales", description: "Configure las cuentas contables puente para comisiones de terminales de pago.", iconName: "smartphone" as const }
            return { title: "Configuración de Tesorería", description: "Gestione las cuentas de ajuste para conciliación bancaria y movimientos de caja.", iconName: "settings" as const }
        }
        if (activeValue === 'movements') return { title: "Movimientos de Tesorería", description: "Registro histórico de ingresos, egresos y traslados de fondos.", iconName: "banknote" as const }
        if (activeValue === 'accounts') {
            if (subActiveValue === 'banks') return { title: "Gestión de Bancos", description: "Administre las entidades bancarias globales del sistema.", iconName: "landmark" as const }
            if (subActiveValue === 'methods') return { title: "Métodos de Pago", description: "Configure los medios de pago aceptados y sus cuentas vinculadas.", iconName: "credit-card" as const }
            return { title: "Cuentas de Tesorería", description: "Registre y configure sus cuentas bancarias y de efectivo.", iconName: "landmark" as const }
        }
        if (activeValue === 'terminal-cobro') {
            if (subActiveValue === 'batches') return { title: "Lotes de Pago", description: "Gestión de cierres diarios y liquidaciones de tarjetas.", iconName: "credit-card" as const }
            if (subActiveValue === 'devices') return { title: "Dispositivos de Pago", description: "Gestione los terminales físicos de cobro y su vinculación con proveedores.", iconName: "smartphone" as const }
            return { title: "Proveedores de Pago", description: "Configuración de cuentas y comisiones por proveedor (TUU, Transbank, etc.).", iconName: "building2" as const }
        }
        if (activeValue === 'reconciliation') {
            if (subActiveValue === 'dashboard') return { title: "Dashboard de Conciliación", description: "Métricas y resumen de la cuadratura contable y bancaria.", iconName: "bar-chart-3" as const }
            if (subActiveValue === 'intelligence') return { title: "Inteligencia de Conciliación", description: "Configura pesos y umbrales para el matching automático por cuenta.", iconName: "brain" as const }
            return { title: "Cartolas Bancarias", description: "Importación y gestión de cartolas para conciliación.", iconName: "file-text" as const }
        }
        return { title: "Tesorería", description: "", iconName: getModuleIconName('treasury') ?? "banknote" }
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
