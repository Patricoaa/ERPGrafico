import { WorkflowSettings } from "@/features/workflow"

export default async function WorkflowSettingsTasksPage() {
    return (
        <div className="pt-4">
            <WorkflowSettings activeTab="tasks" />
        </div>
    )
}
