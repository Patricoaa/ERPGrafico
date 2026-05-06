import { Suspense } from "react"
import { FormSkeleton, PageHeader } from "@/components/shared"
import { WorkflowSettings } from "@/features/workflow"
import { LAYOUT_TOKENS } from "@/lib/styles"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function WorkflowSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "approvals"

    return (
        <Suspense fallback={<FormSkeleton fields={5} />}>
            <div className="pt-4">
                <WorkflowSettings activeTab={activeTab} />
            </div>
        </Suspense>
    )
}
