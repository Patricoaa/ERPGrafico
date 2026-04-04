"use client"

import React, { useState, useEffect, lazy, Suspense } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

// Lazy load components
const TerminalManagement = lazy(() => import("@/features/treasury/components/TerminalManagement"))
const TerminalBatchesManagement = lazy(() => import("@/features/treasury/components/TerminalBatchesManagement"))
const POSSessionsView = lazy(() => import("@/features/sales/components/POSSessionsView").then(m => ({ default: m.POSSessionsView })))

interface SalesTerminalsViewProps {
    activeTab: string
    modal?: string
}

export const SalesTerminalsView: React.FC<SalesTerminalsViewProps> = ({ activeTab, modal }) => {
    const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false)
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

    useEffect(() => {
        if (modal === "new-terminal") setIsTerminalModalOpen(true)
        if (modal === "new-batch") setIsBatchModalOpen(true)
        if (modal === "new-invoice") setIsInvoiceModalOpen(true)
    }, [modal])

    return (
        <Tabs value={activeTab} className="space-y-4">
            <TabsContent value="terminals" className="mt-0 outline-none">
                <Suspense fallback={<LoadingFallback variant="card" />}>
                    <TerminalManagement 
                        externalOpen={isTerminalModalOpen} 
                        onExternalOpenChange={setIsTerminalModalOpen} 
                    />
                </Suspense>
            </TabsContent>

            <TabsContent value="batches" className="mt-0 outline-none">
                <Suspense fallback={<LoadingFallback message="Cargando lotes..." />}>
                    <TerminalBatchesManagement
                        showTitle={false}
                        externalOpenBatch={isBatchModalOpen}
                        onExternalOpenBatchChange={setIsBatchModalOpen}
                        externalOpenInvoice={isInvoiceModalOpen}
                        onExternalOpenInvoiceChange={setIsInvoiceModalOpen}
                    />
                </Suspense>
            </TabsContent>

            <TabsContent value="sessions" className="mt-0 outline-none">
                <Suspense fallback={<LoadingFallback message="Cargando sesiones..." />}>
                    <POSSessionsView hideHeader />
                </Suspense>
            </TabsContent>
        </Tabs>
    )
}

export default SalesTerminalsView
