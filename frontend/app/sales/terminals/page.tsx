"use client"

import { useState } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TerminalManagement } from "@/components/treasury/TerminalManagement"
import { TerminalBatchesManagement } from "@/components/treasury/TerminalBatchesManagement"
import { Banknote, List, Receipt } from "lucide-react"
import POSSessionsPage from "../sessions/page"
import { PageTabs } from "@/components/shared/PageTabs"

export default function TerminalsPage() {
    const tabs = [
        { value: "terminals", label: "Terminales POS", icon: Banknote },
        { value: "batches", label: "Lotes de Liquidación", icon: Receipt },
        { value: "sessions", label: "Historial de Sesiones", icon: List },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            {/* ... (Header) */}

            <Tabs defaultValue="terminals" className="space-y-4">
                <PageTabs tabs={tabs} maxWidth="max-w-2xl" />

                <TabsContent value="terminals">
                    <TerminalManagement />
                </TabsContent>

                <TabsContent value="batches">
                    <TerminalBatchesManagement showTitle={false} />
                </TabsContent>

                <TabsContent value="sessions">
                    <POSSessionsPage />
                </TabsContent>
            </Tabs>
        </div>
    )
}
