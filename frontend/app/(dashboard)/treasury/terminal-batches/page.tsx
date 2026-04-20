"use client"

import { TerminalBatchesManagement } from "@/features/treasury"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { LAYOUT_TOKENS } from "@/lib/styles"
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
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Lotes de Terminales"
                description="Registre liquidaciones y comisiones de terminales de cobro."
                iconName="credit-card"
                variant="minimal"
                titleActions={
                    <PageHeaderButton
                        onClick={() => setOpenInvoice(true)}
                        iconName="file-text"
                        variant="outline"
                        label="Factura Mensual"
                    />
                }
            />

            <div className="pt-4">
                <TerminalBatchesManagement
                    showTitle={false}
                    externalOpenBatch={openBatch}
                    onExternalOpenBatchChange={setOpenBatch}
                    externalOpenInvoice={openInvoice}
                    onExternalOpenInvoiceChange={setOpenInvoice}
                    createAction={createAction}
                />
            </div>
        </div>
    )
}
