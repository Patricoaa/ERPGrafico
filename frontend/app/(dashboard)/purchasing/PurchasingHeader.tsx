"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"
import { useViewModePreference } from "@/hooks/useViewModePreference"

export function PurchasingHeader() {
    const pathname = usePathname()
    const { getViewModeUrl } = useViewModePreference()
    
    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'orders'
    
    const activeValue = currentSegment === 'settings' ? 'orders' : currentSegment
    const subActiveValue = undefined

    const tabs = [
        { value: "orders", label: "Órdenes", iconName: getEntityIconName('purchasing.purchaseorder'), href: getViewModeUrl('purchasing.purchaseorder', "/purchasing/orders") },
        { value: "notes", label: "Notas Crédito/Débito", iconName: "file-text", href: getViewModeUrl('billing.invoice', "/purchasing/notes") },
    ]

    const navigation = {
        moduleName: "Compras",
        moduleHref: getViewModeUrl('purchasing.purchaseorder', "/purchasing/orders"),
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
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
