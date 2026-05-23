import { Suspense, lazy } from "react"
import { SkeletonShell, SimpleTable } from "@/components/shared"

const InventorySettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.InventorySettingsView })))

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function InventorySettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "accounts"

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..."><SimpleTable rows={10} columns={6} /></SkeletonShell>}>
                <InventorySettingsView activeTab={activeTab} />
            </Suspense>
        </div>
    )
}
