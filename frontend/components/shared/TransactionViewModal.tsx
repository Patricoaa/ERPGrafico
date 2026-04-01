"use client"

import React, { useState, useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { Loader2 } from "lucide-react"

import { BaseModal } from "@/components/shared/BaseModal"
import { PaymentForm } from "@/components/forms/PaymentForm"
import { toast } from "sonner"
import api from "@/lib/api"

import type { TransactionType } from "@/types/transactions"

import { BannerStatus } from "./transaction-modal/BannerStatus"
import { SidebarContent } from "./transaction-modal/SidebarContent"
import { PrintableReceipt } from "./transaction-modal/PrintableReceipt"
import { TransactionHeader } from "./transaction-modal/TransactionHeader"
import { TransactionContent } from "./transaction-modal/TransactionContent"
import { useNavigationHistory } from "./transaction-modal/hooks/useNavigationHistory"
import { useTransactionData } from "./transaction-modal/hooks/useTransactionData"

interface TransactionViewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: TransactionType
    id: number | string
    view?: 'details' | 'history' | 'all'
}

export function TransactionViewModal({ open, onOpenChange, type: initialType, id: initialId, view = 'all' }: TransactionViewModalProps) {
    const { currentType, currentId, canGoBack, navigateTo, goBack } = useNavigationHistory(initialType, initialId)
    const { data, loading, refetch } = useTransactionData({ type: currentType, id: currentId, enabled: open })

    const [editingPayment, setEditingPayment] = useState<{ isReceivable?: boolean, amount?: number, transactionId?: number | string, transactionType?: string } | null>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    const handlePrint = useReactToPrint({
        contentRef,
        documentTitle: () => String(data?.display_id || data?.number || "Detalle de Transacción"),
    })

    const handleDeletePayment = async (payId: number) => {
        if (!confirm("¿Está seguro de eliminar este pago?")) return
        try {
            await api.delete(`/treasury/payments/${payId}/`)
            toast.success("Pago eliminado correctamente")
            refetch()
        } catch (error) {
            console.error("Error deleting payment:", error)
            toast.error("Error al eliminar el pago")
        }
    }

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                title="Detalle de Transacción"
                headerClassName="sr-only"
                size="xl"
                hideScrollArea={true}
                className="overflow-hidden p-0 gap-0 print:border-none print:shadow-none print:bg-white print:text-black [&>button[data-slot=dialog-close]]:hidden"
            >
                {/* Standard hidden receipt for actual browser print command */}
                <PrintableReceipt
                    ref={contentRef}
                    data={data}
                    currentType={currentType}
                    mainTitle="Comprobante"
                    subTitle={String(data?.id || '')}
                />

                <div className="flex flex-col h-[90vh] md:h-[85vh] max-h-[900px] bg-background print:hidden">
                    
                    {/* Header Controls */}
                    <TransactionHeader
                        type={currentType}
                        data={data}
                        view={view}
                        canGoBack={canGoBack}
                        onGoBack={goBack}
                        onPrint={handlePrint}
                        onClose={() => onOpenChange(false)}
                    />

                    {/* Main Scrollable Area */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-4">
                                <div className="relative">
                                    <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
                                    <Loader2 className="h-12 w-12 animate-spin text-primary absolute top-0 left-0 [animation-delay:-0.2s]" />
                                </div>
                                <p className="text-[11px] font-black text-primary/40 uppercase tracking-[0.2em] animate-pulse">Procesando Información</p>
                            </div>
                        ) : data ? (
                            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                                {/* Left Content Area (75%) */}
                                <TransactionContent
                                    type={currentType}
                                    data={data}
                                    view={view}
                                    navigateTo={navigateTo}
                                />

                                {/* Right Content Area (25%) - Metadata Sidebar */}
                                <div className="w-full lg:w-[320px] bg-muted/20 border-l border-border/50 lg:min-h-full print:hidden">
                                    <div className="p-8 lg:p-10 lg:sticky lg:top-0 space-y-10">
                                        <SidebarContent
                                            currentType={currentType}
                                            data={data}
                                            closeModal={() => onOpenChange(false)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Inline Payment Editor */}
                {editingPayment && (
                    <PaymentForm
                        open={!!editingPayment}
                        onOpenChange={(open) => !open && setEditingPayment(null)}
                        initialData={{
                            payment_type: editingPayment.isReceivable ? "INBOUND" : "OUTBOUND",
                            amount: editingPayment.amount,
                            invoice_id: editingPayment.transactionId,
                            reference: `Pago para ${editingPayment.transactionType} #${editingPayment.transactionId}`
                        }}
                        onSuccess={() => {
                            setEditingPayment(null)
                            refetch()
                        }}
                    />
                )}
            </BaseModal>
        </>
    )
}
