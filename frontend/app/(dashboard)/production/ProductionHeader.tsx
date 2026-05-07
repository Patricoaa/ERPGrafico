"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function ProductionHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    
    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'orders'
    
    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment
    const subActiveValue = currentSegment === 'settings' ? (searchParams.get('tab') || 'global') : undefined

    const tabs = [
        { value: "orders", label: "Órdenes de Trabajo", iconName: "clipboard-list", href: "/production/orders" },
        { value: "boms", label: "Lista de Materiales", iconName: "layers", href: "/production/boms" },
        { value: "config", label: "Configuración", iconName: "settings", href: "/production/settings" },
    ]

    const navigation = {
        moduleName: "Producción",
        moduleHref: "/production",
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración de Producción", description: "Parametrización de procesos y fichas de fabricación.", iconName: "settings" as const }
        return {
            title: activeValue === 'orders' ? "Centro de Producción" : "Fichas Técnicas (BOM)",
            description: activeValue === 'orders'
                ? "Gestión de procesos fabriles, órdenes de trabajo y seguimiento."
                : "Estructuras de productos, componentes y costos de fabricación.",
            iconName: (activeValue === 'orders' ? "clipboard-list" : "layers") as "clipboard-list" | "layers",
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
