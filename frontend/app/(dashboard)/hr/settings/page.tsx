import { Suspense } from "react"
import { TableSkeleton } from "@/components/shared"
import { HRSettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function HRSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const configTab = tab || "global"

    return (
        <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
            <HRSettingsView activeTab={configTab} />
        </Suspense>
    )
}
