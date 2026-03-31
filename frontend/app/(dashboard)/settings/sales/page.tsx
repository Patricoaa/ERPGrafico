import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/ui/LoadingFallback"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

// Lazy load the SalesSettingsView component
const SalesSettingsView = lazy(() =>
    import("@/features/settings/components/SalesSettingsView").then(module => ({
        default: module.SalesSettingsView
    }))
)

export default async function SalesSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "income"

    return (
        <Suspense fallback={<LoadingFallback message="Cargando configuración..." />}>
            <SalesSettingsView activeTab={activeTab} />
        </Suspense>
    )
}

