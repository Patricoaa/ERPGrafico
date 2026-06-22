"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"
import { useBanks } from "@/features/treasury"
import { useViewModePreference } from "@/hooks/useViewModePreference"

export function TreasuryHeader() {
    const pathname = usePathname()
    const { banks } = useBanks()
    const { getViewModeUrl } = useViewModePreference()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'operaciones'

    const segmentToTab: Record<string, string> = {
        operaciones: 'operaciones',
        'bank-center': 'bank-center',
        'terminal-cobro': 'terminal-cobro',
        reconciliation: 'bank-center',
    }

    const activeValue = segmentToTab[currentSegment] || 'operaciones'

    const subActiveValue = useMemo(() => {
        if (activeValue === 'operaciones') return segments[2] || 'movements'
        if (activeValue === 'terminal-cobro') return segments[2] || 'providers'
        if (activeValue === 'bank-center') {
            const bankIdSegment = segments[2]
            if (bankIdSegment && !isNaN(Number(bankIdSegment))) return `bank-${bankIdSegment}`
            return 'all'
        }
        return undefined
    }, [activeValue, segments])

    const bankSubTabs = useMemo(() => {
        const allTab = { value: 'all', label: 'Todos', iconName: 'layout-grid', href: '/treasury/bank-center' }
        const bankTabs = banks
            .filter(b => b.is_active)
            .map(bank => ({
                value: `bank-${bank.id}`,
                label: bank.name,
                iconName: 'landmark' as string,
                href: `/treasury/bank-center/${bank.id}/overview`,
            }))
        return [allTab, ...bankTabs]
    }, [banks])

    const tabs = [
        {
            value: "operaciones",
            label: "Operaciones",
            iconName: "banknote",
            href: getViewModeUrl('treasury.treasurymovement', "/treasury/operaciones/movements"),
            subTabs: [
                { value: "movements", label: "Movimientos", href: getViewModeUrl('treasury.treasurymovement', "/treasury/operaciones/movements"), iconName: getEntityIconName('treasury.treasurymovement') },
                { value: "accounts", label: "Cuentas de Tesorería", href: getViewModeUrl('treasury.treasuryaccount', "/treasury/operaciones/accounts"), iconName: getEntityIconName('treasury.treasuryaccount') },
                { value: "methods", label: "Métodos de Pago", href: getViewModeUrl('treasury.paymentmethod', "/treasury/operaciones/methods"), iconName: getEntityIconName('treasury.paymentmethod') },
                { value: "checks", label: "Cheques Recibidos", href: getViewModeUrl('treasury.check', "/treasury/operaciones/checks"), iconName: getEntityIconName('treasury.check') },
            ]
        },
        {
            value: "bank-center",
            label: "Centro de Bancos",
            iconName: "landmark",
            href: "/treasury/bank-center",
            subTabs: bankSubTabs,
        },
        {
            value: "terminal-cobro",
            label: "Terminal de Cobro",
            iconName: "credit-card",
            href: "/treasury/terminal-cobro/providers",
            subTabs: [
                { value: "providers", label: "Proveedores", iconName: getEntityIconName('treasury.terminalprovider'), href: getViewModeUrl('treasury.terminalprovider', "/treasury/terminal-cobro/providers") },
                { value: "devices", label: "Dispositivos", iconName: getEntityIconName('treasury.terminaldevice'), href: getViewModeUrl('treasury.terminaldevice', "/treasury/terminal-cobro/devices") },
                { value: "batches", label: "Lotes de Pago", iconName: getEntityIconName('treasury.terminalbatch'), href: getViewModeUrl('treasury.terminalbatch', "/treasury/terminal-cobro/batches") },
            ]
        },
    ]

    const navigation = {
        moduleName: "Tesorería",
        moduleHref: getViewModeUrl('treasury.treasurymovement', "/treasury/operaciones/movements"),
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'operaciones') {
            if (subActiveValue === 'accounts') return { title: "Cuentas de Tesorería", description: "Registre y configure sus cuentas bancarias y de efectivo.", iconName: getEntityIconName('treasury.treasuryaccount') }
            if (subActiveValue === 'methods') return { title: "Métodos de Pago", description: "Configure los medios de pago aceptados y sus cuentas vinculadas.", iconName: getEntityIconName('treasury.paymentmethod') }
            if (subActiveValue === 'checks') return { title: "Gestión de Cheques", description: "Registre, deposite y gestione cheques recibidos y propios.", iconName: getEntityIconName('treasury.check') }
            return { title: "Movimientos de Tesorería", description: "Registro histórico de ingresos, egresos y traslados de fondos.", iconName: getEntityIconName('treasury.treasurymovement') }
        }
        if (activeValue === 'bank-center') {
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
