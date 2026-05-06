"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function ContactsHeader() {
    const navigation = {
        moduleName: "Contactos",
        moduleHref: "/contacts",
    }

    return (
        <PageHeader 
            title="Contactos" 
            description="Directorio de contactos." 
            iconName="users-2" 
            variant="minimal" 
            navigation={navigation} 
        />
    )
}
