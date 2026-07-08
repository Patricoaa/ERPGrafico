"use client"

import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"
import { useViewModePreference } from "@/hooks/useViewModePreference"

export function ContactsHeader() {
    const { getViewModeUrl } = useViewModePreference()
    const tabs = [
        { value: "contacts", label: "Directorio", iconName: getEntityIconName('contacts.contact'), href: getViewModeUrl('contacts.contact', "/contacts") },
    ]

    const navigation = {
        moduleName: "Contactos",
        moduleHref: getViewModeUrl('contacts.contact', "/contacts"),
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
