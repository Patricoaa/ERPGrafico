import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

// Lazy load the InventorySettingsView component
const InventorySettingsView = lazy(() =>
    import("@/features/settings/components/InventorySettingsView").then(module => ({
        default: module.InventorySettingsView
    }))
)

export default async function InventorySettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "accounts"

    return (
        <Suspense fallback={<LoadingFallback message="Cargando configuración..." />}>
            <InventorySettingsView activeTab={activeTab} />
        </Suspense>
    )
}

