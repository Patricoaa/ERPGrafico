"use client"

import { TerminalBatchesManagement } from "@/features/treasury"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { useState } from "react"

export default function TerminalBatchesPage() {
    const [openBatch, setOpenBatch] = useState(false)
    const [openInvoice, setOpenInvoice] = useState(false)

    const createAction = (
        <ToolbarCreateButton
            label="Registrar Liquidación"
            onClick={() => setOpenBatch(true)}
        />
    )

    return (
        <div className="pt-2">
            <TerminalBatchesManagement
                showTitle={false}
                externalOpenBatch={openBatch}
                onExternalOpenBatchChange={setOpenBatch}
                externalOpenInvoice={openInvoice}
                onExternalOpenInvoiceChange={setOpenInvoice}
                createAction={createAction}
            />
        </div>
    )
}
