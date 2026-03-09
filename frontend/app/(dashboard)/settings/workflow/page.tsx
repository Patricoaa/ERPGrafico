import { Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { WorkflowSettings } from "@/components/workflow/WorkflowSettings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function WorkflowSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "approvals"

    return (
        <Suspense fallback={<LoadingFallback message="Cargando configuración..." />}>
            <WorkflowSettings activeTab={activeTab} />
        </Suspense>
    )
}
