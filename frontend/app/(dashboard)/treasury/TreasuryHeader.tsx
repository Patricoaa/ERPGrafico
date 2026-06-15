"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"
import { useBanks } from "@/features/treasury"

export function TreasuryHeader() {
    const pathname = usePathname()
    const { banks } = useBanks()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'operaciones'

    const segmentToTab: Record<string, string> = {
        operaciones: 'operaciones',
        'centro-bancos': 'centro-bancos',
        'terminal-cobro': 'terminal-cobro',
        reconciliation: 'centro-bancos',
        settings: 'config',
    }

    const activeValue = segmentToTab[currentSegment] || 'operaciones'

    const subActiveValue = useMemo(() => {
        if (activeValue === 'config') return segments[2] || 'conciliation'
        if (activeValue === 'operaciones') return segments[2] || 'movements'
        if (activeValue === 'terminal-cobro') return segments[2] || 'providers'
        if (activeValue === 'centro-bancos') {
            const bankIdSegment = segments[2]
            if (bankIdSegment && !isNaN(Number(bankIdSegment))) return `bank-${bankIdSegment}`
            return 'all'
        }
        return undefined
    }, [activeValue, segments])

    const bankSubTabs = useMemo(() => {
        const allTab = { value: 'all', label: 'Todos', iconName: 'layout-grid', href: '/treasury/centro-bancos' }
        const bankTabs = banks
            .filter(b => b.is_active)
            .map(bank => ({
                value: `bank-${bank.id}`,
                label: bank.name,
                iconName: 'landmark' as string,
                href: `/treasury/centro-bancos/${bank.id}/overview`,
            }))
        return [allTab, ...bankTabs]
    }, [banks])

    const tabs = [
        {
            value: "operaciones",
            label: "Operaciones",
            iconName: "banknote",
            href: "/treasury/operaciones/movements",
            subTabs: [
                { value: "movements", label: "Movimientos", href: "/treasury/operaciones/movements", iconName: getEntityIconName('treasury.treasurymovement') },
                { value: "accounts", label: "Cuentas de Tesorería", href: "/treasury/operaciones/accounts", iconName: getEntityIconName('treasury.treasuryaccount') },
                { value: "methods", label: "Métodos de Pago", href: "/treasury/operaciones/methods", iconName: getEntityIconName('treasury.paymentmethod') },
                { value: "checks", label: "Cheques Recibidos", href: "/treasury/operaciones/checks", iconName: getEntityIconName('treasury.check') },
            ]
        },
        {
            value: "centro-bancos",
            label: "Centro de Bancos",
            iconName: "landmark",
            href: "/treasury/centro-bancos",
            subTabs: bankSubTabs,
        },
        {
            value: "terminal-cobro",
            label: "Terminal de Cobro",
            iconName: "cpu",
            href: "/treasury/terminal-cobro/providers",
            subTabs: [
                { value: "providers", label: "Proveedores", iconName: getEntityIconName('treasury.terminalprovider'), href: "/treasury/terminal-cobro/providers" },
                { value: "devices", label: "Dispositivos", iconName: getEntityIconName('treasury.terminaldevice'), href: "/treasury/terminal-cobro/devices" },
                { value: "batches", label: "Lotes de Pago", iconName: getEntityIconName('treasury.terminalbatch'), href: "/treasury/terminal-cobro/batches" },
            ]
        },
        {
            value: "config",
            label: "Configuración",
            iconName: "settings",
            href: "/treasury/settings/conciliation",
            subTabs: [
                { value: "conciliation", label: "Cuentas Contables", href: "/treasury/settings/conciliation", iconName: "arrow-left-right" },
                { value: "financial", label: "Gastos Financieros", href: "/treasury/settings/financial", iconName: "trending-up" },
                { value: "checks", label: "Cuentas de Cheques", href: "/treasury/settings/checks", iconName: "file-check" },
                { value: "movements", label: "Movimientos Manuales POS", href: "/treasury/settings/movements", iconName: "shuffle" },
                { value: "audit", label: "Arqueo de Caja", href: "/treasury/settings/audit", iconName: "wallet" },
                { value: "terminals", label: "Sistema", href: "/treasury/settings/terminals", iconName: "settings" },
            ]
        },
    ]

    const navigation = {
        moduleName: "Tesorería",
        moduleHref: "/treasury/operaciones/movements",
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
            if (subActiveValue === 'accounts') return { title: "Cuentas de Tesorería", description: "Registre y configure sus cuentas bancarias y de efectivo.", iconName: getEntityIconName('treasury.treasuryaccount') }
            if (subActiveValue === 'methods') return { title: "Métodos de Pago", description: "Configure los medios de pago aceptados y sus cuentas vinculadas.", iconName: getEntityIconName('treasury.paymentmethod') }
            if (subActiveValue === 'checks') return { title: "Gestión de Cheques", description: "Registre, deposite y gestione cheques recibidos y propios.", iconName: getEntityIconName('treasury.check') }
            return { title: "Movimientos de Tesorería", description: "Registro histórico de ingresos, egresos y traslados de fondos.", iconName: getEntityIconName('treasury.treasurymovement') }
        }
        if (activeValue === 'centro-bancos') {
            const bankIdSegment = segments[2]
            if (bankIdSegment && !isNaN(Number(bankIdSegment))) {
                const selectedBank = banks.find(b => b.id === Number(bankIdSegment))
                return {
                    title: selectedBank?.name || "Banco",
                    description: "Vista unificada: cuentas, productos financieros y conciliación del banco.",
                    iconName: "landmark" as const
                }
            }
            return { title: "Centro de Bancos", description: "Vista consolidada de todos sus bancos, productos financieros y vencimientos.", iconName: "landmark" as const }
        }
        if (activeValue === 'terminal-cobro') {
            if (subActiveValue === 'batches') return { title: "Lotes de Pago", description: "Gestión de cierres diarios y liquidaciones de tarjetas.", iconName: getEntityIconName('treasury.terminalbatch') }
            if (subActiveValue === 'devices') return { title: "Dispositivos de Pago", description: "Gestione los terminales físicos de cobro y su vinculación con proveedores.", iconName: getEntityIconName('treasury.terminaldevice') }
            return { title: "Proveedores de Pago", description: "Configuración de cuentas y comisiones por proveedor (TUU, Transbank, etc.).", iconName: getEntityIconName('treasury.terminalprovider') }
        }
        return { title: "Tesorería", description: "", iconName: getEntityIconName('treasury.treasurymovement') ?? "banknote" }
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
