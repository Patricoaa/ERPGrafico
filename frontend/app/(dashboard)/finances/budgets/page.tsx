import React from "react"
import { BudgetsListView } from "@/features/finance/components/BudgetsListView"
import { BudgetVarianceView } from "@/features/finance/components/BudgetVarianceView"

interface BudgetsPageProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    tab?: string
    createAction?: React.ReactNode
}

export default function BudgetsPage({ externalOpen, onExternalOpenChange, tab, createAction }: BudgetsPageProps) {
    return (
        <div className="pt-2">
            {tab === 'versus' ? (
                <BudgetVarianceView />
            ) : (
                <BudgetsListView externalOpen={externalOpen} onExternalOpenChange={onExternalOpenChange} createAction={createAction} />
            )}
        </div>
    )
}
