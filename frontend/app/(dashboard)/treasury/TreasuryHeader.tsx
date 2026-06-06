"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { PageHeader } from "@/components/shared"
import { getModuleIconName } from "@/lib/module-registry"
import { useBanks } from "@/features/treasury"

export function TreasuryHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { banks } = useBanks()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'operaciones'

    const segmentToTab: Record<string, string> = {
        operaciones: 'operaciones',
        movements: 'operaciones',
        accounts: 'operaciones',
        'centro-bancos': 'centro-bancos',
        banks: 'centro-bancos',
        'terminal-cobro': 'terminal-cobro',
        reconciliation: 'centro-bancos',
        settings: 'config',
    }

    const activeValue = segmentToTab[currentSegment] || 'operaciones'

    const tabParam = searchParams.get('tab')
    const bankParam = searchParams.get('bank')

    const subActiveValue = useMemo(() => {
        if (activeValue === 'config') return tabParam || 'conciliation'
        if (activeValue === 'operaciones') return tabParam || 'movements'
        if (activeValue === 'terminal-cobro') return tabParam || 'providers'
        if (activeValue === 'centro-bancos') {
            // New segment-based routing: /centro-bancos/[bankId]/...
            const bankIdSegment = segments[2]
            if (bankIdSegment && !isNaN(Number(bankIdSegment))) return `bank-${bankIdSegment}`
            // Legacy query-param fallback
            if (bankParam) return `bank-${bankParam}`
            return 'all'
        }
        return undefined
    }, [activeValue, tabParam, bankParam, segments])

    const bankSubTabs = useMemo(() => {
        const allTab = { value: 'all', label: 'Todos', iconName: 'layout-grid', href: '/treasury/centro-bancos' }
        const bankTabs = banks
            .filter(b => b.is_active)
            .map(bank => ({
                value: `bank-${bank.id}`,
                label: bank.name,
                iconName: 'landmark' as string,
                href: `/treasury/centro-bancos/${bank.id}`,
            }))
        return [allTab, ...bankTabs]
    }, [banks])

    const tabs = [
        {
            value: "operaciones",
            label: "Operaciones",
            iconName: "banknote",
            href: "/treasury/operaciones?tab=movements",
            subTabs: [
                { value: "movements", label: "Movimientos", href: "/treasury/operaciones?tab=movements", iconName: "banknote" },
                { value: "accounts", label: "Cuentas de Tesorería", href: "/treasury/operaciones?tab=accounts", iconName: "landmark" },
                { value: "methods", label: "Métodos de Pago", href: "/treasury/operaciones?tab=methods", iconName: "credit-card" },
                { value: "checks", label: "Cheques Recibidos", href: "/treasury/operaciones?tab=checks", iconName: "check-square" },
            ]
        },
        {
            value: "centro-bancos",
            label: "Centro de Bancos",
            iconName: "landmark",
            href: "/treasury/centro-bancos?tab=all",
            subTabs: bankSubTabs,
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
            value: "config",
            label: "Configuración",
            iconName: "settings",
            href: "/treasury/settings?tab=conciliation",
            subTabs: [
                { value: "conciliation", label: "Cuentas Contables", href: "/treasury/settings?tab=conciliation", iconName: "arrow-left-right" },
                { value: "financial", label: "Gastos Financieros", href: "/treasury/settings?tab=financial", iconName: "trending-up" },
                { value: "checks", label: "Cuentas de Cheques", href: "/treasury/settings?tab=checks", iconName: "file-check" },
                { value: "movements", label: "Movimientos Manuales POS", href: "/treasury/settings?tab=movements", iconName: "shuffle" },
                { value: "audit", label: "Arqueo de Caja", href: "/treasury/settings?tab=audit", iconName: "wallet" },
                { value: "terminals", label: "Sistema", href: "/treasury/settings?tab=terminals", iconName: "settings" },
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
            if (subActiveValue === 'financial') return { title: "Cuentas de Gasto Financiero", description: "Cuentas contables para intereses, seguros, mora, comisiones de apertura e impuesto de timbres de préstamos.", iconName: "trending-up" as const }
            if (subActiveValue === 'checks') return { title: "Cuentas de Cheques", description: "Cuentas puente para contabilización de cheques recibidos y emitidos.", iconName: "file-check" as const }
            if (subActiveValue === 'movements') return { title: "Cuentas para Movimientos Manuales", description: "Configuración de ingresos y egresos ad-hoc del módulo POS.", iconName: "shuffle" as const }
            if (subActiveValue === 'audit') return { title: "Arqueo de Caja", description: "Control de discrepancias entre saldo teórico y físico en POS.", iconName: "wallet" as const }
            if (subActiveValue === 'terminals') return { title: "Sistema", description: "Configure cuentas puente de terminales y otros ajustes del sistema.", iconName: "settings" as const }
            return { title: "Cuentas Contables", description: "Gestione las cuentas contables para conciliación, arqueo y gastos financieros.", iconName: "arrow-left-right" as const }
        }
        if (activeValue === 'operaciones') {
            if (subActiveValue === 'accounts') return { title: "Cuentas de Tesorería", description: "Registre y configure sus cuentas bancarias y de efectivo.", iconName: "landmark" as const }
            if (subActiveValue === 'methods') return { title: "Métodos de Pago", description: "Configure los medios de pago aceptados y sus cuentas vinculadas.", iconName: "credit-card" as const }
            if (subActiveValue === 'checks') return { title: "Gestión de Cheques", description: "Registre, deposite y gestione cheques recibidos y propios.", iconName: "check-square" as const }
            return { title: "Movimientos de Tesorería", description: "Registro histórico de ingresos, egresos y traslados de fondos.", iconName: "banknote" as const }
        }
        if (activeValue === 'centro-bancos') {
            if (bankParam) {
                const selectedBank = banks.find(b => b.id === Number(bankParam))
                return {
                    title: selectedBank?.name || "Banco",
                    description: "Vista unificada: cuentas, productos financieros y conciliación del banco.",
                    iconName: "landmark" as const
                }
            }
            return { title: "Centro de Bancos", description: "Vista consolidada de todos sus bancos, productos financieros y vencimientos.", iconName: "landmark" as const }
        }
        if (activeValue === 'terminal-cobro') {
            if (subActiveValue === 'batches') return { title: "Lotes de Pago", description: "Gestión de cierres diarios y liquidaciones de tarjetas.", iconName: "credit-card" as const }
            if (subActiveValue === 'devices') return { title: "Dispositivos de Pago", description: "Gestione los terminales físicos de cobro y su vinculación con proveedores.", iconName: "smartphone" as const }
            return { title: "Proveedores de Pago", description: "Configuración de cuentas y comisiones por proveedor (TUU, Transbank, etc.).", iconName: "building2" as const }
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
