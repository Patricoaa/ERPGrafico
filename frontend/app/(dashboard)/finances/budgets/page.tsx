import React from "react"
import { BudgetsListView, BudgetVarianceView } from "@/features/finance"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function BudgetsPage({ searchParams }: PageProps) {
    const { tab, modal } = await searchParams
    const activeTab = tab || "list"

    const createAction = activeTab === 'list' ? (
        <ToolbarCreateButton
            label="Nuevo Presupuesto"
            href="/finances/budgets?tab=list&modal=new"
        />
    ) : null

    return (
        <div className="pt-2">
            {activeTab === 'versus' ? (
                <BudgetVarianceView />
            ) : (
                <BudgetsListView 
                    externalOpen={modal === 'new'} 
                    createAction={createAction} 
                />
            )}
        </div>
    )
}
