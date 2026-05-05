import { Suspense } from "react"
import { TableSkeleton } from "@/components/shared"
import { BillingSettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function BillingSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const configTab = tab || "accounts"

    return (
        <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
            <BillingSettingsView activeTab={configTab} />
        </Suspense>
    )
}
