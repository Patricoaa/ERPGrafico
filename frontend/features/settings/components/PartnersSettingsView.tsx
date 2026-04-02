"use client"

import React from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { EquityCompositionTab } from "./partners/EquityCompositionTab"
import { PartnerLedgerTab } from "./partners/PartnerLedgerTab"
import { PartnerAccountingTab } from "./partners/PartnerAccountingTab"
import { ProfitDistributionsTab } from "./partners/ProfitDistributionsTab"

export function PartnersSettingsView({ activeTab = "composition" }: { activeTab?: string }) {
    return (
        <div className="space-y-6">
            <Tabs value={activeTab} className="w-full">
                <TabsContent value="composition">
                    <EquityCompositionTab />
                </TabsContent>
                <TabsContent value="ledger">
                    <PartnerLedgerTab />
                </TabsContent>
                <TabsContent value="distributions">
                    <ProfitDistributionsTab />
                </TabsContent>
                <TabsContent value="config">
                    <PartnerAccountingTab />
                </TabsContent>
            </Tabs>
        </div>
    )
}
