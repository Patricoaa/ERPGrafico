import { Suspense, lazy } from "react"
import { SkeletonShell, SimpleTable } from "@/components/shared"

const ProductionSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.ProductionSettingsView })))

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function ProductionSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const configTab = tab || "global"

    return (
        <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..."><SimpleTable rows={10} columns={6} /></SkeletonShell>}>
            <ProductionSettingsView />
        </Suspense>
    )
}
