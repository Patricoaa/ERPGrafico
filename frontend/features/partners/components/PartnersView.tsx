"use client"

import React from "react"
import { PartnersClientView } from "./PartnersClientView"
import { ProfitDistributionsTab } from "./ProfitDistributionsTab"

interface PartnersViewProps {
    activeTab?: string
    initialFlowOpen?: boolean
    initialAddPartnerOpen?: boolean
    createAction?: React.ReactNode
}

export function PartnersView({
    activeTab = "composition",
    initialFlowOpen = false,
    initialAddPartnerOpen = false,
    createAction
}: PartnersViewProps) {
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
