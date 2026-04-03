"use client"

import React, { useEffect } from "react"
import { EquityCompositionTab } from "./partners/EquityCompositionTab"
import { PartnerLedgerTab } from "./partners/PartnerLedgerTab"
import { ProfitDistributionsTab } from "./partners/ProfitDistributionsTab"

interface PartnersSettingsViewProps {
    activeTab?: string
    onSavingChange?: (saving: boolean) => void
}

export function PartnersSettingsView({ activeTab = "composition", onSavingChange }: PartnersSettingsViewProps) {
    // We could use this to track saving state if needed, 
    // for now we'll just pass it down if any sub-tab needs it.
    useEffect(() => {
        // Reset saving state when switching tabs if desired
        onSavingChange?.(false)
    }, [activeTab, onSavingChange])

    return (
        <div className="space-y-6">
            {activeTab === "composition" && (
                <EquityCompositionTab />
            )}
            
            {activeTab === "ledger" && (
                <PartnerLedgerTab />
            )}
            
            {activeTab === "distributions" && (
                <ProfitDistributionsTab />
            )}
        </div>
    )
}
