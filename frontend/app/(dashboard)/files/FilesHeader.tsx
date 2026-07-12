"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function FilesHeader() {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const activeValue = segments[1] || 'browser'

    const tabs = [
        {
            value: "browser",
            label: "Archivos",
            iconName: "folder",
            href: "/files",
        }
    ]

    const navigation = {
        moduleName: "Archivos",
        moduleHref: "/files",
        tabs,
        activeValue,
    }

    return (
        <PageHeader
            title="Archivos"
            description="Gestión de documentos y adjuntos."
            iconName="folder"
            variant="minimal"
            navigation={navigation}
        />
    )
}
