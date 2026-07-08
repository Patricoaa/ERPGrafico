"use client"

import { useState } from "react"
import { PageSectionHeader } from "@/components/shared"
import { FinancialStatementsReport } from "@/features/finance"

export default function StatementsBsPage() {
    const [periodLabel, setPeriodLabel] = useState<string | undefined>()

    return (
        <>
            <PageSectionHeader
                title="Balance General"
                description={periodLabel ? `Situación patrimonial y financiera · ${periodLabel}` : "Situación patrimonial y financiera"}
            />
            <FinancialStatementsReport activeTab="bs" onPeriodLabelChange={setPeriodLabel} />
        </>)
}
