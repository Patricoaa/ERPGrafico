"use client"

import React, { useState } from "react"
import { Building2, PieChart, History } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"
import { EquityCompositionTab } from "@/components/settings/partners/EquityCompositionTab"
import { PartnerLedgerTab } from "@/components/settings/partners/PartnerLedgerTab"
import { LAYOUT_TOKENS } from "@/lib/styles"

export default function PartnersSettingsPage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "composition"

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Socios y Capital"
                description="Gestión de composición societaria, aportes y retiros"
                icon={Building2}
            />

            <ServerPageTabs
                tabs={[
                    { 
                        value: "composition", 
                        label: "Composición Societaria", 
                        iconName: "pie-chart", 
                        href: "/settings/partners?tab=composition" 
                    },
                    { 
                        value: "ledger", 
                        label: "Libro Auxiliar (Ledger)", 
                        iconName: "history", 
                        href: "/settings/partners?tab=ledger" 
                    },
                ]}
                activeValue={activeTab}
                maxWidth="max-w-md"
            />

            <div className="mt-6">
                <Tabs value={activeTab} className="w-full">
                    <TabsContent value="composition">
                        <EquityCompositionTab />
                    </TabsContent>
                    <TabsContent value="ledger">
                        <PartnerLedgerTab />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
