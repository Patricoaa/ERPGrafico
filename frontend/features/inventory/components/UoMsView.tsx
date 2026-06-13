"use client"

import React from "react"
import { UoMClientView } from "@/features/inventory/components/UoMClientView"
import { UoMCategoryClientView } from "@/features/inventory/components/UoMCategoryClientView"

interface UoMsViewProps {
    activeTab: string
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

/**
 * View component for Units of Measure and Categories.
 * Refactored to remove redundant headers and fix TabsContent context error.
 * Navigation is now handled at the page level.
 */
export function UoMsView({ activeTab, externalOpen, onExternalOpenChange, createAction }: UoMsViewProps) {
    return (
        <div className="h-full flex flex-col">
            {activeTab === "units" && (
                <UoMClientView
                    externalOpen={externalOpen}
                    onExternalOpenChange={onExternalOpenChange}
                    createAction={createAction}
                />
            )}
            {activeTab === "categories" && (
                <UoMCategoryClientView
                    externalOpen={externalOpen}
                    onExternalOpenChange={onExternalOpenChange}
                    createAction={createAction}
                />
            )}
        </div>
    )
}
