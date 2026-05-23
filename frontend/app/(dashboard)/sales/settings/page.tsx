import { Suspense, lazy } from "react"
import { SkeletonShell, SimpleTable } from "@/components/shared"

const SalesSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.SalesSettingsView })))

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function SalesSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "income"

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..."><SimpleTable rows={10} columns={6} /></SkeletonShell>}>
                <SalesSettingsView activeTab={activeTab} />
            </Suspense>
        </div>
    )
}
