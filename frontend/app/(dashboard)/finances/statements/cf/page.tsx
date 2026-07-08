"use client"

import { useState } from "react"
import { PageSectionHeader } from "@/components/shared"
import { FinancialStatementsReport } from "@/features/finance"

export default function StatementsCfPage() {
    const [periodLabel, setPeriodLabel] = useState<string | undefined>()

    return (
        <>
            <PageSectionHeader
                title="Flujo de Caja"
                description={periodLabel ? `Movimientos de efectivo del período · ${periodLabel}` : "Movimientos de efectivo del período"}
            />
            <FinancialStatementsReport activeTab="cf" onPeriodLabelChange={setPeriodLabel} />
        </>)
}
