"use client"


import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"

export function ContactsHeader() {
    const tabs = [
        { value: "contacts", label: "Directorio", iconName: getEntityIconName('contacts.contact'), href: "/contacts" },
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
            iconName={getEntityIconName('contacts.contact') ?? "users"}
            variant="minimal"
            navigation={navigation}
        />
    )
}
