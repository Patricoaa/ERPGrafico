import { PageSectionHeader } from "@/components/shared"
import { WorkflowSettings } from "@/features/workflow"

export default async function WorkflowSettingsApprovalsPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Aprobaciones" description="Configuración de flujos de aprobación" />
            <WorkflowSettings activeTab="approvals" />
        </>)
}
