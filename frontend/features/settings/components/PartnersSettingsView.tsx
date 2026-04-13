"use client"

import React, { useEffect } from "react"
import { EquityCompositionTab } from "./partners/EquityCompositionTab"
import { ProfitDistributionsTab } from "./partners/ProfitDistributionsTab"

interface PartnersSettingsViewProps {
    activeTab?: string
    onSavingChange?: (saving: boolean) => void
    /** Whether the new-distribution modal should open on mount */
    initialFlowOpen?: boolean
    /** Callback to clear the modal query param from the URL */
    onModalClose?: () => void
    initialAddPartnerOpen?: boolean
    initialStatsOpen?: boolean
}

export function PartnersSettingsView({ 
    activeTab = "composition", 
    onSavingChange,
    initialFlowOpen = false,
    initialAddPartnerOpen = false,
    initialStatsOpen = false,
    onModalClose
}: PartnersSettingsViewProps) {
    // Reset saving state when switching tabs.
    // We use a small delay to ensure this doesn't conflict with parent's mount/render cycle
    // especially when rendered within a Suspense boundary.
    useEffect(() => {
        const timer = setTimeout(() => {
            onSavingChange?.(false)
        }, 0)
        return () => clearTimeout(timer)
    }, [activeTab, onSavingChange])

    return (
        <div className="space-y-6">
            {activeTab === "composition" && (
                <EquityCompositionTab 
                    initialAddPartnerOpen={initialAddPartnerOpen}
                    initialStatsOpen={initialStatsOpen}
                    onModalClose={onModalClose}
                />
            )}
            
            {activeTab === "distributions" && (
                <ProfitDistributionsTab 
                    initialFlowOpen={initialFlowOpen}
                    onModalClose={onModalClose}
                />
            )}
        </div>
    )
}
