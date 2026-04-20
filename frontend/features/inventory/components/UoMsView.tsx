"use client"

import React from "react"
import { UoMList } from "@/features/inventory/components/UoMList"
import { UoMCategoryList } from "@/features/inventory/components/UoMCategoryList"

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
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === "units" && (
                <UoMList
                    externalOpen={externalOpen}
                    onExternalOpenChange={onExternalOpenChange}
                    createAction={createAction}
                />
            )}
            {activeTab === "categories" && (
                <UoMCategoryList
                    externalOpen={externalOpen}
                    onExternalOpenChange={onExternalOpenChange}
                    createAction={createAction}
                />
            )}
        </div>
    )
}
