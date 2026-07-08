"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"
import { useViewModePreference } from "@/hooks/useViewModePreference"

export function SalesHeader() {
    const pathname = usePathname()
    const { getViewModeUrl } = useViewModePreference()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'orders'

    // Map physical routes to tab values
    const segmentToTab: Record<string, string> = {
        orders: 'orders',
        pos: 'pos',
        credits: 'credits',
        sessions: 'pos',
        settings: 'config',
    }

    const activeValue = segmentToTab[currentSegment] || 'orders'

    // Determine subActiveValue from path segments
    const subActiveValue = (() => {
        if (activeValue === 'config') return segments[2] || 'credit'
        if (activeValue === 'orders') return segments[2] || 'orders'
        if (activeValue === 'pos') {
            if (currentSegment === 'sessions') return 'sessions'
            return segments[2] || 'cajas'
        }
        if (activeValue === 'credits') return segments[2] || 'portfolio'
        return undefined
    })()

    const tabs = [
        {
            value: "orders",
            label: "Órdenes",
            iconName: getEntityIconName('sales.saleorder'),
            href: getViewModeUrl('sales.saleorder', "/sales/orders"),
            subTabs: [
                { value: "orders", label: "Notas de Venta", href: getViewModeUrl('sales.saleorder', "/sales/orders") },
                { value: "deliveries", label: "Despachos", href: "/sales/deliveries" },
                { value: "notes", label: "Ajustes (N/C N/D)", href: "/sales/orders/notes" },
            ]
        },
        {
            value: "pos",
            label: "POS",
            iconName: "banknote",
            href: "/sales/pos/cajas",
            subTabs: [
                { value: "cajas", label: "Cajas", href: "/sales/pos/cajas" },
                { value: "sessions", label: "Sesiones", href: "/sales/sessions" },
            ]
        },
        {
            value: "credits",
            label: "Cartera",
            iconName: "pie-chart",
            href: "/sales/credits",
            subTabs: [
                { value: "portfolio", label: "Cartera", href: "/sales/credits/portfolio" },
                { value: "history", label: "Historial", href: "/sales/credits/history" },
                { value: "blacklist", label: "Lista Negra", href: "/sales/credits/blacklist" },
            ]
        },
        {
            value: "config",
            label: "Configuración",
            iconName: "settings",
            href: "/sales/settings",
            subTabs: [
                { value: "credit", label: "Crédito", href: "/sales/settings/credit", iconName: "credit-card" },
                { value: "config-pos", label: "POS", href: "/sales/settings/config-pos", iconName: "settings" },
            ]
        },
    ]

    const navigation = {
        moduleName: "Ventas",
        moduleHref: getViewModeUrl('sales.saleorder', "/sales/orders"),
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración de Ventas", description: "Gestione las políticas de crédito y parámetros del POS.", iconName: "settings" as const }
        if (activeValue === 'credits') {
            if (subActiveValue === 'history') return { title: "Historial de Asignaciones", description: "Registro global de créditos asignados a clientes.", iconName: "history" as const }
            if (subActiveValue === 'blacklist') return { title: "Lista Negra", description: "Clientes con historial de impago o riesgo crediticio.", iconName: "user-x" as const }
            return { title: "Cartera de Créditos", description: "Saldo por cliente, clasificación por antigüedad y estado de cobro.", iconName: "pie-chart" as const }
        }
        if (activeValue === 'pos') {
            if (subActiveValue === 'sessions') return { title: "Sesiones Punto de Venta", description: "Historial de aperturas y cierres de caja.", iconName: "list" as const }
            return { title: "Cajas POS", description: "Administre los puntos de venta y sus métodos de pago autorizados.", iconName: "banknote" as const }
        }
        if (activeValue === 'orders') {
            if (subActiveValue === 'notes') return { title: "Notas de Crédito y Débito", description: "Gestión de devoluciones, correcciones de facturación y ajustes de cuenta.", iconName: "file-text" as const }
            if (subActiveValue === 'deliveries') return { title: "Guías de Despacho", description: "Historial de envíos y entregas a clientes, incluyendo notas de débito.", iconName: "truck" as const }
            return { title: "Notas de Venta", description: "Seguimiento de pedidos, estados de fabricación y logística de entregas.", iconName: getEntityIconName('sales.saleorder') }
        }
        return { title: "Ventas", description: "", iconName: getEntityIconName('sales.saleorder') ?? "shopping-cart" }
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
