import React from "react"
import { BudgetsListView, BudgetVarianceView } from "@/features/finance"

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
