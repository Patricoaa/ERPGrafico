import { Suspense } from "react"
import { LoadingFallback } from "@/components/ui/LoadingFallback"
import { BillingSettingsView } from "@/features/settings/components/BillingSettingsView"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function BillingSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "accounts"

    return (
        <Suspense fallback={<LoadingFallback message="Cargando configuración..." />}>
            <BillingSettingsView activeTab={activeTab} />
        </Suspense>
    )
}

