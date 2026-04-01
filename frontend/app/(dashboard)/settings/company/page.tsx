import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

// Lazy load the CompanySettingsView component
const CompanySettingsView = lazy(() =>
    import("@/features/settings/components/CompanySettingsView").then(module => ({
        default: module.CompanySettingsView
    }))
)

export default async function CompanySettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "general"

    return (
        <Suspense fallback={<LoadingFallback message="Cargando configuración de empresa..." />}>
            <CompanySettingsView activeTab={activeTab} />
        </Suspense>
    )
}

