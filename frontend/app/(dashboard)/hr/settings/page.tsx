import { Suspense } from "react"
import { redirect } from "next/navigation"
import { TableSkeleton } from "@/components/shared"
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
        <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
            <HRSettingsView activeTab={configTab} />
        </Suspense>
    )
}
