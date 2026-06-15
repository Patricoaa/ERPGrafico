import { WorkflowSettings } from "@/features/workflow"

export default async function WorkflowSettingsApprovalsPage() {
    return (
        <div className="pt-4">
            <WorkflowSettings activeTab="approvals" />
        </div>
    )
}
