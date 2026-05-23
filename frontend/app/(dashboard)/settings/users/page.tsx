"use client"

import { type ReactNode, lazy, Suspense, useState } from "react"
import { SkeletonShell, SimpleTable } from "@/components/shared"
import { PageHeader } from "@/components/shared/PageHeader"
import { useSearchParams } from "next/navigation"

// Lazy load the UsersSettingsView component
const UsersSettingsView = lazy(() =>
    import("@/features/settings").then(module => ({
        default: module.UsersSettingsView
    }))
)

export default function UsersSettingsPage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "users"

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando usuarios"><SimpleTable rows={10} columns={5} /></SkeletonShell>}>
                <UsersSettingsView 
                    activeTab={activeTab} 
                />
            </Suspense>
        </div>
    )
}
