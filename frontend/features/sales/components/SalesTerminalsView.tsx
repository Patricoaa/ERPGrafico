"use client"

import React, { useState } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TerminalManagement } from "@/features/treasury/components/TerminalManagement"
import { TerminalBatchesManagement } from "@/features/treasury/components/TerminalBatchesManagement"
import { Banknote, List, Receipt, Plus, Store } from "lucide-react"
import { POSSessionsView } from "@/features/sales/components/POSSessionsView"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface SalesTerminalsViewProps {
    activeTab: string
}

export const SalesTerminalsView: React.FC<SalesTerminalsViewProps> = ({ activeTab }) => {
    const router = useRouter()
    const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false)
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

    const tabs = [
        { value: "terminals", label: "Terminales POS", iconName: "banknote", href: "/sales/terminals?tab=terminals" },
        { value: "batches", label: "Lotes de Liquidación", iconName: "receipt", href: "/sales/terminals?tab=batches" },
        { value: "sessions", label: "Historial de Sesiones", iconName: "list", href: "/sales/terminals?tab=sessions" },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "terminals":
                return {
                    title: "Terminales POS",
                    description: "Administre los puntos de venta y sus métodos de pago autorizados.",
                    actions: (
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsTerminalModalOpen(true)} title="Nuevo Terminal">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )
                }
            case "batches":
                return {
                    title: "Lotes de Liquidación",
                    description: "Registre liquidaciones y comisiones de terminales de cobro.",
                    actions: (
                        <div className="flex items-center gap-2">
                            <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsBatchModalOpen(true)} title="Registrar Liquidación">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    ),
                    children: (
                        <Button variant="outline" size="sm" onClick={() => setIsInvoiceModalOpen(true)}>
                            <Receipt className="mr-2 h-4 w-4" /> Factura Mensual
                        </Button>
                    )
                }
            case "sessions":
                return {
                    title: "Historial de Sesiones",
                    description: "Registro cronológico de aperturas y cierres de terminales POS.",
                    actions: null,
                    children: (
                        <Button onClick={() => router.push('/sales/pos')} className="bg-primary hover:bg-primary/90">
                            <Store className="mr-2 h-4 w-4" />
                            Ir al POS
                        </Button>
                    )
                }
            default:
                return { title: "Terminales", description: "", actions: null }
        }
    }

    const { title, description, actions, children } = getHeaderConfig()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={activeTab} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-2xl" />

                <PageHeader
                    title={title}
                    description={description}
                    titleActions={actions}
                >
                    {children}
                </PageHeader>

                <TabsContent value="terminals" className="mt-0 outline-none">
                    <Suspense fallback={<LoadingFallback />}>
                        <TerminalManagement externalOpen={isTerminalModalOpen} onExternalOpenChange={setIsTerminalModalOpen} />
                    </Suspense>
                </TabsContent>

                <TabsContent value="batches" className="mt-0 outline-none">
                    <TerminalBatchesManagement
                        showTitle={false}
                        externalOpenBatch={isBatchModalOpen}
                        onExternalOpenBatchChange={setIsBatchModalOpen}
                        externalOpenInvoice={isInvoiceModalOpen}
                        onExternalOpenInvoiceChange={setIsInvoiceModalOpen}
                    />
                </TabsContent>

                <TabsContent value="sessions" className="mt-0 outline-none">
                    <POSSessionsView hideHeader />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default SalesTerminalsView
