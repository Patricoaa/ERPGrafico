import { Suspense, lazy } from "react"
import { TableSkeleton } from "@/components/shared"

const TreasurySettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.TreasurySettingsView })))

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function TreasurySettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "conciliation"

    return (
        <div className="pt-2">
            <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                <TreasurySettingsView activeTab={activeTab} />
            </Suspense>
        </div>
    )
}
