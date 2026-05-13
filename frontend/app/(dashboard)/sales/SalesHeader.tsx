"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { ENTITY_REGISTRY } from "@/lib/entity-registry"

export function SalesHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'orders'

    // Map physical routes to tab values
    const segmentToTab: Record<string, string> = {
        orders: 'orders',
        terminals: 'pos',   // pos lives at /terminals
        credits: 'credits',
        sessions: 'pos',    // sessions is a sub of POS tab
        settings: 'config',
    }

    // Detect hardware sub-tabs from ?tab= param
    const isHardwareTab = ['providers', 'devices', 'batches'].includes(searchParams.get('tab') || '')
    const activeValue = isHardwareTab ? 'hardware' : (segmentToTab[currentSegment] || 'orders')

    const tabParam = searchParams.get('tab')
    const viewParam = searchParams.get('view')

    // Determine subActiveValue
    const subActiveValue = (() => {
        if (activeValue === 'config') return tabParam || 'income'
        if (activeValue === 'orders') return tabParam || 'orders'
        if (activeValue === 'hardware') return tabParam || 'batches'
        if (activeValue === 'pos') {
            if (currentSegment === 'sessions') return 'sessions'
            return tabParam || 'pos-terminals'
        }
        if (activeValue === 'credits') return tabParam || 'portfolio'
        return undefined
    })()

    const tabs = [
        {
            value: "orders",
            label: "Órdenes",
            iconName: "shopping-cart",
            href: "/sales/orders",
            subTabs: [
                { value: "orders", label: ENTITY_REGISTRY['sales.saleorder']?.titlePlural || "Notas de Venta", href: "/sales/orders?tab=orders" },
                { value: "notes", label: "Ajustes (N/C N/D)", href: "/sales/orders?tab=notes" },
            ]
        },
        {
            value: "pos",
            label: "POS",
            iconName: "banknote",
            href: "/sales/terminals?tab=pos-terminals",
            subTabs: [
                { value: "pos-terminals", label: "POS", href: "/sales/terminals?tab=pos-terminals" },
                { value: "sessions", label: "Sesiones", href: "/sales/sessions" },
            ]
        },
        {
            value: "hardware",
            label: "Terminal de Cobro",
            iconName: "cpu",
            href: "/sales/terminals?tab=batches",
            subTabs: [
                { value: "providers", label: "Proveedor de dispositivos", href: "/sales/terminals?tab=providers" },
                { value: "devices", label: "Dispositivos", href: "/sales/terminals?tab=devices" },
                { value: "batches", label: "Lotes de Pago", href: "/sales/terminals?tab=batches" },
            ]
        },
        {
            value: "credits",
            label: "Cartera",
            iconName: "pie-chart",
            href: "/sales/credits",
            subTabs: [
                { value: "portfolio", label: "Cartera", href: "/sales/credits?tab=portfolio" },
                { value: "history", label: "Historial", href: "/sales/credits?tab=history" },
                { value: "blacklist", label: "Lista Negra", href: "/sales/credits?tab=blacklist" },
            ]
        },
        {
            value: "config",
            label: "Configuración",
            iconName: "settings",
            href: "/sales/settings",
            subTabs: [
                { value: "income", label: "Ingresos", href: "/sales/settings?tab=income", iconName: "trending-up" },
                { value: "credit", label: "Crédito", href: "/sales/settings?tab=credit", iconName: "credit-card" },
                { value: "config_pos", label: "POS", href: "/sales/settings?tab=config_pos", iconName: "settings" },
                { value: "terminals", label: "Terminales", href: "/sales/settings?tab=terminals", iconName: "wallet" },
            ]
        },
    ]

    const navigation = {
        moduleName: "Ventas",
        moduleHref: "/sales/orders?tab=orders",
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración de Ventas", description: "Gestione los ingresos, políticas de crédito y parámetros del POS.", iconName: "settings" as const }
        if (activeValue === 'credits') {
            if (subActiveValue === 'history') return { title: "Historial de Asignaciones", description: "Registro global de créditos asignados a clientes.", iconName: "history" as const }
            if (subActiveValue === 'blacklist') return { title: "Lista Negra", description: "Clientes con historial de impago o riesgo crediticio.", iconName: "user-x" as const }
            return { title: "Cartera de Créditos", description: "Saldo por cliente, clasificación por antigüedad y estado de cobro.", iconName: "pie-chart" as const }
        }
        if (activeValue === 'hardware') {
            if (subActiveValue === 'batches') return { title: "Lotes de Pago", description: "Gestión de cierres diarios y liquidaciones de tarjetas.", iconName: "cpu" as const }
            if (subActiveValue === 'devices') return { title: "Hardware de Pago", description: "Gestione los dispositivos físicos y su vinculación con el sistema.", iconName: "cpu" as const }
            return { title: "Proveedores de Pago", description: "Configuración de cuentas y comisiones por proveedor (TUU, Transbank, etc.).", iconName: "cpu" as const }
        }
        if (activeValue === 'pos') {
            if (subActiveValue === 'sessions') return { title: "Sesiones Punto de Venta", description: "Historial de aperturas y cierres de caja.", iconName: "list" as const }
            return { title: "Cajas POS", description: "Administre los puntos de venta y sus métodos de pago autorizados.", iconName: "banknote" as const }
        }
        if (activeValue === 'orders') {
            if (subActiveValue === 'notes') return { title: "Notas de Crédito y Débito", description: "Gestión de devoluciones, correcciones de facturación y ajustes de cuenta.", iconName: "file-text" as const }
            return { title: ENTITY_REGISTRY['sales.saleorder']?.titlePlural || "Notas de Venta", description: "Seguimiento de pedidos, estados de fabricación y logística de entregas.", iconName: "shopping-cart" as const }
        }
        return { title: "Ventas", description: "", iconName: "shopping-cart" as const }
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
