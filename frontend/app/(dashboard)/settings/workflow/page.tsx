import { WorkflowSettings } from "@/features/workflow"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function WorkflowSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "approvals"

    return (
        <div className="pt-4">
            <WorkflowSettings activeTab={activeTab} />
        </div>
    )
}
