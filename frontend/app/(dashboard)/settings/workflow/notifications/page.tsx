import { WorkflowSettings } from "@/features/workflow"

export default async function WorkflowSettingsNotificationsPage() {
    return (
        <div className="pt-4">
            <WorkflowSettings activeTab="notif" />
        </div>
    )
}
