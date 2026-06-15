"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"

export function PurchasingHeader() {
    const pathname = usePathname()
    
    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'orders'
    
    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment
    const subActiveValue = currentSegment === 'settings' ? (segments[2] || 'global') : undefined

    const tabs = [
        { value: "orders", label: "Órdenes", iconName: getEntityIconName('purchasing.purchaseorder'), href: "/purchasing/orders" },
        { value: "notes", label: "Notas Crédito/Débito", iconName: "file-text", href: "/purchasing/notes" },
        { value: "config", label: "Configuración", iconName: "settings", href: "/purchasing/settings" },
    ]

    const navigation = {
        moduleName: "Compras",
        moduleHref: "/purchasing/orders",
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración de Compras", description: "Gestione las cuentas de gastos para diferentes tipos de compras.", iconName: "settings" as const }
        if (activeValue === 'notes') return { title: "Notas de Crédito y Débito", description: "Gestión de notas de crédito y débito de proveedores", iconName: "file-text" as const }
        return { title: "Órdenes de Compra", description: "Gestión integral de órdenes de compra y recepciones", iconName: getEntityIconName('purchasing.purchaseorder') ?? "shopping-bag" }
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
