"use client"

import { TerminalBatchesManagement } from "@/features/treasury"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useState } from "react"

export default function TerminalBatchesPage() {
    const [openBatch, setOpenBatch] = useState(false)
    const [openInvoice, setOpenInvoice] = useState(false)

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Lotes de Terminales"
                description="Registre liquidaciones y comisiones de terminales de cobro."
                iconName="credit-card"
                variant="minimal"
                titleActions={
                    <div className="flex items-center gap-2">
                        <PageHeaderButton
                            onClick={() => setOpenInvoice(true)}
                            iconName="file-text"
                            variant="outline"
                            label="Factura Mensual"
                        />
                        <PageHeaderButton
                            onClick={() => setOpenBatch(true)}
                            iconName="plus"
                            circular
                            title="Registrar Liquidación"
                        />
                    </div>
                }
            />

            <div className="pt-4">
                <TerminalBatchesManagement
                    showTitle={false}
                    externalOpenBatch={openBatch}
                    onExternalOpenBatchChange={setOpenBatch}
                    externalOpenInvoice={openInvoice}
                    onExternalOpenInvoiceChange={setOpenInvoice}
                />
            </div>
        </div>
    )
}
