"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName, getDomainConceptTitle } from "@/lib/entity-registry"
import { useViewModePreference } from "@/hooks/useViewModePreference"

export function ProductionHeader() {
    const pathname = usePathname()
    const { getViewModeUrl } = useViewModePreference()
    
    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'orders'
    
    const activeValue = currentSegment === 'settings' ? 'orders' : currentSegment
    const subActiveValue = undefined

    const tabs = [
        { value: "orders", label: getDomainConceptTitle('ot', true), iconName: getEntityIconName('production.workorder'), href: getViewModeUrl('production.workorder', "/production/orders") },
        { value: "boms", label: getDomainConceptTitle('ldm'), iconName: getEntityIconName('production.bom'), href: getViewModeUrl('production.bom', "/production/boms") },
    ]

    const navigation = {
        moduleName: "Producción",
        moduleHref: getViewModeUrl('production.workorder', "/production/orders"),
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'boms') return { title: getDomainConceptTitle('ldm', true), description: "Estructuras de productos, componentes y costos de fabricación.", iconName: "layers" as const }
        return { title: getDomainConceptTitle('ot', true), description: "Planificación y seguimiento de procesos fabriles.", iconName: getEntityIconName('production.workorder') ?? "printer" }
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
