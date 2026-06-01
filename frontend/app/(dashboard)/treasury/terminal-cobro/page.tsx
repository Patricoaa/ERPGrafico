"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { PaymentHardwareManagement, TerminalBatchesManagement } from "@/features/treasury"
import { ToolbarCreateButton } from '@/components/shared'

export default function TerminalCobroPage() {
    const searchParams = useSearchParams()
    const tabParam = searchParams.get('tab')
    const activeTab = tabParam || "providers"

    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false)
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false)
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

    const getCreateAction = () => {
        switch (activeTab) {
            case "providers":
                return <ToolbarCreateButton label="Nuevo Proveedor" onClick={() => setIsProviderModalOpen(true)} />
            case "devices":
                return <ToolbarCreateButton label="Nuevo Dispositivo" onClick={() => setIsDeviceModalOpen(true)} />
            case "batches":
                return <ToolbarCreateButton label="Registrar Liquidación" onClick={() => setIsBatchModalOpen(true)} />
            default:
                return null
        }
    }

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Tabs value={activeTab} className="h-full flex flex-col">
                <TabsContent value="providers" className="mt-0 outline-none flex-1 min-h-0">
                    <PaymentHardwareManagement
                        activeTab="providers"
                        externalProviderOpen={isProviderModalOpen}
                        onExternalProviderOpenChange={setIsProviderModalOpen}
                        createAction={activeTab === "providers" ? getCreateAction() : undefined}
                    />
                </TabsContent>

                <TabsContent value="devices" className="mt-0 outline-none flex-1 min-h-0">
                    <PaymentHardwareManagement
                        activeTab="devices"
                        externalDeviceOpen={isDeviceModalOpen}
                        onExternalDeviceOpenChange={setIsDeviceModalOpen}
                        createAction={activeTab === "devices" ? getCreateAction() : undefined}
                    />
                </TabsContent>

                <TabsContent value="batches" className="mt-0 outline-none flex-1 min-h-0">
                    <TerminalBatchesManagement
                        showTitle={false}
                        externalOpenBatch={isBatchModalOpen}
                        onExternalOpenBatchChange={setIsBatchModalOpen}
                        externalOpenInvoice={isInvoiceModalOpen}
                        onExternalOpenInvoiceChange={setIsInvoiceModalOpen}
                        createAction={activeTab === "batches" ? getCreateAction() : undefined}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
