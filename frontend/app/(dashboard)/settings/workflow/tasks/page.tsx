import { PageSectionHeader } from "@/components/shared"
import { WorkflowSettings } from "@/features/workflow"

export default async function WorkflowSettingsTasksPage() {
    return (
        <>
            <PageSectionHeader title="Tareas Automáticas" description="Configuración de procesos programados y automatizaciones" />
            <WorkflowSettings activeTab="tasks" />
        </>)
}
