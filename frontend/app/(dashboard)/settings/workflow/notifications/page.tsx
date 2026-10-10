import { PageSectionHeader } from "@/components/shared"
import { WorkflowSettings } from "@/features/workflow"

export default async function WorkflowSettingsNotificationsPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Notificaciones" description="Reglas de notificaciones y alertas del sistema" />
            <WorkflowSettings activeTab="notif" />
        </>)
}
