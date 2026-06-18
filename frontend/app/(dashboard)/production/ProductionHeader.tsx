"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"

export function ProductionHeader() {
    const pathname = usePathname()
    
    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'orders'
    
    const activeValue = currentSegment === 'settings' ? 'orders' : currentSegment
    const subActiveValue = undefined

    const tabs = [
        { value: "orders", label: "Órdenes de Trabajo", iconName: getEntityIconName('production.workorder'), href: "/production/orders" },
        { value: "boms", label: "Lista de Materiales", iconName: getEntityIconName('production.bom'), href: "/production/boms" },
    ]

    const navigation = {
        moduleName: "Producción",
        moduleHref: "/production",
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'boms') return { title: "Fichas Técnicas (BOM)", description: "Estructuras de productos, componentes y costos de fabricación.", iconName: "layers" as const }
        return { title: "Centro de Producción", description: "Gestión de procesos fabriles, órdenes de trabajo y seguimiento.", iconName: getEntityIconName('production.workorder') ?? "printer" }
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
