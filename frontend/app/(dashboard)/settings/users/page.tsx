"use client"


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
