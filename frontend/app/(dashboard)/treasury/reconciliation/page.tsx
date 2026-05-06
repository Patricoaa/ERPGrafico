import React from "react"
import { Metadata } from "next"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { StatementsList, ReconciliationDashboard, ReconciliationIntelligence } from "@/features/finance/bank-reconciliation/components"

export const metadata: Metadata = {
    title: "Conciliación Bancaria | ERPGrafico",
    description: "Gestión de cartolas y cuadratura de movimientos bancarios.",
}

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function ReconciliationPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams
    const activeTab = resolvedParams.tab || "statements"
    const modalOpen = resolvedParams.modal === "import"

    const statementsCreateAction = (
        <ToolbarCreateButton
            label="Importar Cartola"
            iconName="upload"
            href="/treasury/reconciliation?tab=statements&modal=import"
        />
    )

    return (
        <div className="pt-2">
            <Tabs value={activeTab} className="space-y-4">
                <TabsContent value="statements" className="mt-0 outline-none">
                    <StatementsList externalOpen={modalOpen} createAction={statementsCreateAction} />
                </TabsContent>
                <TabsContent value="dashboard" className="mt-0 outline-none">
                    <ReconciliationDashboard />
                </TabsContent>
                <TabsContent value="intelligence" className="mt-0 outline-none">
                    <ReconciliationIntelligence externalOpen={resolvedParams.modal === "new-rule"} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
