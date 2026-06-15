"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"

export function BillingHeader() {
    const pathname = usePathname()
    
    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'sales'
    
    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment
    const subActiveValue = currentSegment === 'settings' ? (segments[2] || 'accounts') : undefined

    const tabs = [
        { value: "sales", label: "Emitidos (Ventas)", iconName: getEntityIconName('billing.invoice'), href: "/billing/sales" },
        { value: "purchases", label: "Recibidos (Compras)", iconName: getEntityIconName('billing.purchaseinvoice'), href: "/billing/purchases" },
        { 
            value: "config", 
            label: "Configuración", 
            iconName: "settings", 
            href: "/billing/settings",
            subTabs: [
                { value: "accounts", label: "Cuentas", href: "/billing/settings/accounts", iconName: "users" },
                { value: "dtes", label: "Documentos", href: "/billing/settings/dtes", iconName: "file-text" }
            ]
        },
    ]

    const navigation = {
        moduleName: "Facturación",
        moduleHref: "/billing",
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración de Facturación", description: "Gestione las cuentas contables y parámetros de documentos electrónicos.", iconName: "settings" }
        return {
            title: activeValue === 'sales' ? "Facturación de Ventas" : "Facturación de Compras",
            description: activeValue === 'sales'
                ? "Gestión de boletas, facturas y notas de venta emitidas a clientes."
                : "Recepción y cuadratura de facturas y notas de crédito de proveedores.",
            iconName: getEntityIconName(activeValue === 'sales' ? 'billing.invoice' : 'billing.purchaseinvoice'),
        }
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
