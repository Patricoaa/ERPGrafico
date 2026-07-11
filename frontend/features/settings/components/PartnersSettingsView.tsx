"use client"

import React from "react"
import { PartnersClientView } from "./partners/PartnersClientView"
import { ProfitDistributionsTab } from "./partners/ProfitDistributionsTab"

interface PartnersSettingsViewProps {
    activeTab?: string
    initialFlowOpen?: boolean
    initialAddPartnerOpen?: boolean
    createAction?: React.ReactNode
}

export function PartnersSettingsView({
    activeTab = "composition",
    initialFlowOpen = false,
    initialAddPartnerOpen = false,
    createAction
}: PartnersSettingsViewProps) {
    return (
        <div className="h-full flex flex-col overflow-y-auto">
            {activeTab === "composition" && (
                <PartnersClientView
                    initialAddPartnerOpen={initialAddPartnerOpen}
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
