"use client"

import { lazy, Suspense } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { useSearchParams } from "next/navigation"
import { UsersSettingsView } from "@/features/settings"

export default function UsersSettingsPage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "users"

    return (
        <UsersSettingsView 
            activeTab={activeTab} 
        />
    )
}
