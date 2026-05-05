import { Suspense, lazy } from "react"
import { TableSkeleton } from "@/components/shared"

const SalesSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.SalesSettingsView })))

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function SalesSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "income"

    return (
        <div className="pt-2">
            <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                <SalesSettingsView activeTab={activeTab} />
            </Suspense>
        </div>
    )
}
