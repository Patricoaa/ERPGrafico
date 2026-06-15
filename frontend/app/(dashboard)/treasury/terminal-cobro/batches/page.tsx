"use client"

import { useState } from "react"
import { TerminalBatchesManagement } from "@/features/treasury"
import { ToolbarCreateButton } from '@/components/shared'

export default function TerminalCobroBatchesPage() {
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

    const createAction = (
        <ToolbarCreateButton label="Registrar Liquidación" onClick={() => setIsBatchModalOpen(true)} />
    )

    return (
        <TerminalBatchesManagement
            showTitle={false}
            externalOpenBatch={isBatchModalOpen}
            onExternalOpenBatchChange={setIsBatchModalOpen}
            externalOpenInvoice={isInvoiceModalOpen}
            onExternalOpenInvoiceChange={setIsInvoiceModalOpen}
            createAction={createAction}
        />
    )
}
