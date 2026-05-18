"use client"

import React, { use } from "react"
import { BudgetsListView, BudgetVarianceView } from "@/features/finance"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { FadeIn } from "@/components/shared"

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default function BudgetsPage({ searchParams }: PageProps) {
    const { tab, modal } = use(searchParams)
    const activeTab = tab || "list"

    const createAction = activeTab === 'list' ? (
        <ToolbarCreateButton
            label="Nuevo Presupuesto"
            href="/finances/budgets?tab=list&modal=new"
        />
    ) : null

    return (
        <div className="pt-2">
            <FadeIn key={activeTab}>
                {activeTab === 'versus' ? (
                    <BudgetVarianceView />
                ) : (
                    <BudgetsListView 
                        externalOpen={modal === 'new'} 
                        createAction={createAction} 
                    />
                )}
            </FadeIn>
        </div>
    )
}
