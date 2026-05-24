import { Suspense, lazy } from "react"
import { SkeletonShell } from "@/components/shared"

const TreasurySettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.TreasurySettingsView })))

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function TreasurySettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "conciliation"

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                <TreasurySettingsView activeTab={activeTab} />
            </Suspense>
        </div>
    )
}
