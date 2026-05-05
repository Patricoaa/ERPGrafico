"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function PurchasingHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    
    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'orders'
    
    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment
    const subActiveValue = currentSegment === 'settings' ? (searchParams.get('tab') || 'global') : undefined

    const tabs = [
        { value: "orders", label: "Órdenes", iconName: "shopping-cart", href: "/purchasing/orders" },
        { value: "notes", label: "Notas Crédito/Débito", iconName: "file-text", href: "/purchasing/notes" },
        { value: "config", label: "Config", iconName: "settings", href: "/purchasing/settings" },
    ]

    const navigation = {
        moduleName: "Compras",
        moduleHref: "/purchasing",
        tabs,
        activeValue,
        subActiveValue,
        configHref: "/purchasing/settings"
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración de Compras", description: "Gestione las cuentas de gastos para diferentes tipos de compras.", iconName: "settings" as const }
        return {
            title: activeValue === 'orders' ? "Órdenes de Compra" : "Notas de Crédito y Débito",
            description: activeValue === 'orders'
                ? "Gestión integral de órdenes de compra y recepciones"
                : "Gestión de notas de crédito y débito de proveedores",
            iconName: (activeValue === 'orders' ? "shopping-cart" : "file-text") as "shopping-cart" | "file-text",
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
