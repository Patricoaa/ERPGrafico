"use client"

import React, { useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ModuleSettingsSheet, SavingStatus } from "./ModuleSettingsSheet"
import { LucideIcon } from "lucide-react"

interface SettingsSheetRouteWrapperProps {
    sheetId: string
    title: string
    description?: string
    icon?: LucideIcon
    tabLabel?: string
    savingStatus?: SavingStatus
    children: React.ReactNode
    fullWidth?: number
}

export function SettingsSheetRouteWrapper({
    sheetId,
    title,
    description,
    icon,
    tabLabel,
    savingStatus,
    children,
    fullWidth
}: SettingsSheetRouteWrapperProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const isConfigOpen = searchParams.get("config") === "true"

    const handleOpenChange = useCallback((open: boolean) => {
        const params = new URLSearchParams(searchParams.toString())
        if (open) {
            params.set("config", "true")
        } else {
            params.delete("config")
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [pathname, router, searchParams])

    return (
        <ModuleSettingsSheet
            sheetId={sheetId}
            open={isConfigOpen}
            onOpenChange={handleOpenChange}
            title={title}
            description={description}
            icon={icon}
            tabLabel={tabLabel}
            savingStatus={savingStatus}
            fullWidth={fullWidth}
        >
            {children}
        </ModuleSettingsSheet>
    )
}
