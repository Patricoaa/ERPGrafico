import { Suspense, lazy } from "react"
import { SkeletonShell, SimpleTable } from "@/components/shared"

const PurchasingSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.PurchasingSettingsView })))

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function PurchasingSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const configTab = tab || "global"

    return (
        <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..."><SimpleTable rows={10} columns={6} /></SkeletonShell>}>
            <PurchasingSettingsView />
        </Suspense>
    )
}
