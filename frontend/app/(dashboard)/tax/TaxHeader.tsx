"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function TaxHeader() {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const activeValue = segments[1] || 'dashboard'

    const tabs = [
        {
            value: "dashboard",
            label: "Impuestos",
            iconName: "landmark",
            href: "/tax",
        }
    ]

    const navigation = {
        moduleName: "Impuestos",
        moduleHref: "/tax",
        tabs,
        activeValue,
    }

    return (
        <PageHeader
            title="Impuestos"
            description="Gestión de impuestos y retenciones."
            iconName="landmark"
            variant="minimal"
            navigation={navigation}
        />
    )
}
