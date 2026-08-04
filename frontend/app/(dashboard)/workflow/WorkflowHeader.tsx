"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function WorkflowHeader() {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const activeValue = segments[1] || 'inbox'

    const tabs = [
        {
            value: "inbox",
            label: "Inbox",
            iconName: "inbox",
            href: "/workflow",
        }
    ]

    const navigation = {
        moduleName: "Workflow",
        moduleHref: "/workflow",
        tabs,
        activeValue,
    }

    return (
        <PageHeader
            title="Workflow"
            description="Gestión de tareas y aprobaciones."
            iconName="inbox"
            variant="minimal"
            navigation={navigation}
        />
    )
}
