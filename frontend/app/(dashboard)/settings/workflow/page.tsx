import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { WorkflowSettings } from "@/features/workflow"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { LAYOUT_TOKENS } from "@/lib/styles"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function WorkflowSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "approvals"

    const tabs = [
        { value: "approvals", label: "Aprobaciones", iconName: "check-circle-2", href: "/settings/workflow?tab=approvals" },
        { value: "tasks", label: "Tareas", iconName: "list-todo", href: "/settings/workflow?tab=tasks" },
        { value: "notif", label: "Notificaciones", iconName: "bell", href: "/settings/workflow?tab=notif" },
    ]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Configuración de Workflow"
                description="Defina los responsables por defecto para cada etapa y tarea automática del sistema."
                variant="minimal"
                iconName="settings"
            />
            
            <div className="pt-2">
                <PageTabs tabs={tabs} activeValue={activeTab} />
            </div>

            <Suspense fallback={<FormSkeleton count={5} />}>
                <div className="pt-4">
                    <WorkflowSettings activeTab={activeTab} />
                </div>
            </Suspense>
        </div>
    )
}
