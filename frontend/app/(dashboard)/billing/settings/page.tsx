import { Suspense } from "react"
import { SkeletonShell, SimpleTable } from "@/components/shared"
import { BillingSettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function BillingSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const configTab = tab || "accounts"

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando configuración"><SimpleTable rows={10} columns={6} /></SkeletonShell>}>
                <BillingSettingsView activeTab={configTab} />
            </Suspense>
        </div>
    )
}
