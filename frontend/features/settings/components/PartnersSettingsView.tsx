"use client"

import React from "react"
import { EquityCompositionTab } from "./partners/EquityCompositionTab"
import { ProfitDistributionsTab } from "./partners/ProfitDistributionsTab"

interface PartnersSettingsViewProps {
    activeTab?: string
    initialFlowOpen?: boolean
    initialAddPartnerOpen?: boolean
    initialStatsOpen?: boolean
    createAction?: React.ReactNode
}

export function PartnersSettingsView({
    activeTab = "composition",
    initialFlowOpen = false,
    initialAddPartnerOpen = false,
    initialStatsOpen = false,
    createAction
}: PartnersSettingsViewProps) {
    return (
        <div className="h-full flex flex-col overflow-y-auto">
            {activeTab === "composition" && (
                <EquityCompositionTab
                    initialAddPartnerOpen={initialAddPartnerOpen}
                    initialStatsOpen={initialStatsOpen}
                    createAction={createAction}
                />
            )}

            {activeTab === "distributions" && (
                <ProfitDistributionsTab
                    initialFlowOpen={initialFlowOpen}
                    createAction={createAction}
                />
            )}
        </div>
    )
}
