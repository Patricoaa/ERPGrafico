"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getModuleIconName } from "@/lib/module-registry"

export function ProductionHeader() {
    const pathname = usePathname()
    
    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'orders'
    
    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment
    const subActiveValue = currentSegment === 'settings' ? (segments[2] || 'global') : undefined

    const tabs = [
        { value: "orders", label: "Órdenes de Trabajo", iconName: "printer", href: "/production/orders" },
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
        if (activeValue === 'boms') return { title: "Fichas Técnicas (BOM)", description: "Estructuras de productos, componentes y costos de fabricación.", iconName: "layers" as const }
        return { title: "Centro de Producción", description: "Gestión de procesos fabriles, órdenes de trabajo y seguimiento.", iconName: getModuleIconName('production') ?? "printer" }
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
