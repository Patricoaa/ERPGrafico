import { Suspense } from "react"
import { SkeletonShell, PageHeader } from "@/components/shared"
import { WorkflowSettings } from "@/features/workflow"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function WorkflowSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "approvals"

    return (
        <Suspense fallback={<SkeletonShell isLoading={true} ariaLabel="Cargando configuración de workflow" />}>
            <div className="pt-4">
                <WorkflowSettings activeTab={activeTab} />
            </div>
        </Suspense>
    )
}
