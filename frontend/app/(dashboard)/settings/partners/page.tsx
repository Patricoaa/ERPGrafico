"use client"

import React, { useState } from "react"
import { Building2, PieChart, History, Settings } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"
import { EquityCompositionTab } from "@/features/settings/components/partners/EquityCompositionTab"
import { PartnerLedgerTab } from "@/features/settings/components/partners/PartnerLedgerTab"
import { PartnerAccountingTab } from "@/features/settings/components/partners/PartnerAccountingTab"
import { ProfitDistributionsTab } from "@/features/settings/components/partners/ProfitDistributionsTab"
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

            <PageTabs
                tabs={[
                    {
                        value: "composition",
                        label: "Composición Societaria",
                        iconName: "pie-chart",
                        href: "/settings/partners?tab=composition"
                    },
                    {
                        value: "ledger",
                        label: "Movimientos de Capital",
                        iconName: "history",
                        href: "/settings/partners?tab=ledger"
                    },
                    {
                        value: "distributions",
                        label: "Distribución de Utilidades",
                        iconName: "pie-chart",
                        href: "/settings/partners?tab=distributions"
                    },
                    {
                        value: "config",
                        label: "Configuración",
                        iconName: "settings",
                        href: "/settings/partners?tab=config"
                    },
                ]}
                activeValue={activeTab}
                maxWidth="max-w-4xl"
            />

            <div className="mt-6">
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
        </div>
    )
}
