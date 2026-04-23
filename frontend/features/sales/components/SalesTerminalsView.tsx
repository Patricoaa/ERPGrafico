"use client"

import React, { useState, useEffect, lazy, Suspense } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { CardSkeleton, TableSkeleton } from "@/components/shared"

// Lazy load components
const TerminalManagement = lazy(() => import("@/features/treasury/components/TerminalManagement"))
const TerminalBatchesManagement = lazy(() => import("@/features/treasury/components/TerminalBatchesManagement"))
const PaymentHardwareManagement = lazy(() => import("@/features/treasury/components/PaymentHardwareManagement"))
const POSSessionsView = lazy(() => import("@/features/sales/components/POSSessionsView").then(m => ({ default: m.POSSessionsView })))

interface SalesTerminalsViewProps {
    activeTab: string
    modal?: string
    createAction?: React.ReactNode
}

export const SalesTerminalsView: React.FC<SalesTerminalsViewProps> = ({ activeTab, modal, createAction }) => {
    const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false)
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false)
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false)

    useEffect(() => {
        requestAnimationFrame(() => {
            if (modal === "new-terminal") setIsTerminalModalOpen(true)
            if (modal === "new-batch") setIsBatchModalOpen(true)
            if (modal === "new-invoice") setIsInvoiceModalOpen(true)
            if (modal === "new-device") setIsDeviceModalOpen(true)
            if (modal === "new-provider") setIsProviderModalOpen(true)
        })
    }, [modal])

    return (
        <Tabs value={activeTab} className="space-y-4">
            <TabsContent value="pos-terminals" className="mt-0 outline-none">
                <Suspense fallback={<CardSkeleton variant="grid" count={3} />}>
                    <TerminalManagement
                        externalOpen={isTerminalModalOpen}
                        onExternalOpenChange={setIsTerminalModalOpen}
                        createAction={activeTab === "pos-terminals" ? createAction : undefined}
                    />
                </Suspense>
            </TabsContent>

            <TabsContent value="sessions" className="mt-0 outline-none">
                <Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
                    <POSSessionsView hideHeader />
                </Suspense>
            </TabsContent>

            <TabsContent value="batches" className="mt-0 outline-none">
                <Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
                    <TerminalBatchesManagement
                        showTitle={false}
                        externalOpenBatch={isBatchModalOpen}
                        onExternalOpenBatchChange={setIsBatchModalOpen}
                        externalOpenInvoice={isInvoiceModalOpen}
                        onExternalOpenInvoiceChange={setIsInvoiceModalOpen}
                        createAction={activeTab === "batches" ? createAction : undefined}
                    />
                </Suspense>
            </TabsContent>

            <TabsContent value="devices" className="mt-0 outline-none">
                <Suspense fallback={<CardSkeleton variant="grid" count={3} />}>
                   <PaymentHardwareManagement
                        externalDeviceOpen={isDeviceModalOpen}
                        onExternalDeviceOpenChange={setIsDeviceModalOpen}
                        activeTab="devices"
                        createAction={activeTab === "devices" ? createAction : undefined}
                   />
                </Suspense>
            </TabsContent>

            <TabsContent value="providers" className="mt-0 outline-none">
                <Suspense fallback={<CardSkeleton variant="grid" count={3} />}>
                   <PaymentHardwareManagement
                        externalProviderOpen={isProviderModalOpen}
                        onExternalProviderOpenChange={setIsProviderModalOpen}
                        activeTab="providers"
                        createAction={activeTab === "providers" ? createAction : undefined}
                   />
                </Suspense>
            </TabsContent>
        </Tabs>
    )
}

export default SalesTerminalsView
