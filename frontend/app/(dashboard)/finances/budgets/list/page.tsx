"use client"

import React, { use } from "react"
import { BudgetsListView } from "@/features/finance"
import { ToolbarCreateButton } from '@/components/shared'

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default function BudgetsListPage({ searchParams }: PageProps) {
    const { modal } = use(searchParams)
    const createAction = (
        <ToolbarCreateButton label="Nuevo Presupuesto" href="/finances/budgets/list?modal=new" />
    )

    return <BudgetsListView externalOpen={modal === 'new'} createAction={createAction} />
}
