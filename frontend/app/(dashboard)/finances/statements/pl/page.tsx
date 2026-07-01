"use client"

import { useState } from "react"
import { PageSectionHeader } from "@/components/shared"
import { FinancialStatementsReport } from "@/features/finance"

export default function StatementsPlPage() {
    const [periodLabel, setPeriodLabel] = useState<string | undefined>()

    return (
        <>
            <PageSectionHeader
                title="Estado de Resultados"
                description={periodLabel ? `Ingresos, costos y resultados del período · ${periodLabel}` : "Ingresos, costos y resultados del período"}
            />
            <FinancialStatementsReport activeTab="pl" onPeriodLabelChange={setPeriodLabel} />
        </>)
}
