import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

// Lazy load the heavy SalesTerminalsView component
const SalesTerminalsView = lazy(() => import("@/features/sales/components/SalesTerminalsView"))

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function TerminalsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "terminals"

    return (
        <Suspense fallback={<LoadingFallback message="Cargando terminales..." />}>
            <SalesTerminalsView activeTab={activeTab} />
        </Suspense>
    )
}
