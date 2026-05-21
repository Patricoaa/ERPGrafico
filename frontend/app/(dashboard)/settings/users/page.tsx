"use client"

import { type ReactNode, lazy, Suspense, useState } from "react"
import { TableSkeleton } from "@/components/shared"
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
        <div className="pt-2 h-[calc(100vh-140px)] flex flex-col">
            <Suspense fallback={<TableSkeleton rows={10} columns={5} />}>
                <UsersSettingsView 
                    activeTab={activeTab} 
                />
            </Suspense>
        </div>
    )
}
