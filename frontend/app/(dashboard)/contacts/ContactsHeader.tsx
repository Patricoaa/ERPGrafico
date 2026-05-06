"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function ContactsHeader() {
    const tabs = [
        { value: "contacts", label: "Directorio", iconName: "users-2", href: "/contacts" },
    ]

    const navigation = {
        moduleName: "Contactos",
        moduleHref: "/contacts",
        tabs,
        activeValue: "contacts",
        configHref: "/contacts/settings"
    }

    return (
        <PageHeader 
            title="Contactos" 
            description="Directorio de clientes, proveedores y contactos." 
            iconName="users-2" 
            variant="minimal" 
            navigation={navigation} 
        />
    )
}
