"use client"


import { PageHeader } from "@/components/shared"
import { getModuleIconName } from "@/lib/module-registry"

export function ContactsHeader() {
    const tabs = [
        { value: "contacts", label: "Directorio", iconName: "users-2", href: "/contacts" },
        { value: "config", label: "Configuración", iconName: "settings", href: "/contacts/settings" },
    ]

    const navigation = {
        moduleName: "Contactos",
        moduleHref: "/contacts",
        tabs,
        activeValue: "contacts",
    }

    return (
        <PageHeader
            title="Contactos"
            description="Directorio de clientes, proveedores y contactos."
            iconName={getModuleIconName('contacts') ?? "users"}
            variant="minimal"
            navigation={navigation}
        />
    )
}
