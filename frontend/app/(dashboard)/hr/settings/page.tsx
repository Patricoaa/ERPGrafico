import { Suspense } from "react"
import { redirect } from "next/navigation"
import { SkeletonShell } from "@/components/shared"
import { HRSettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function HRSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const configTab = tab || "global"

    if (!tab) {
        redirect('/hr/settings?tab=global')
    }

    return (
        <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
            <HRSettingsView activeTab={configTab} />
        </Suspense>
    )
}
