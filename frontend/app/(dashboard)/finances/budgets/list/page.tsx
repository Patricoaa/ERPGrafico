import type { Metadata } from "next"
import { BudgetsListView } from "@/features/finance"
import { ToolbarCreateButton } from '@/components/shared'

export const metadata: Metadata = {
    title: "Presupuestos | ERPGrafico",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function BudgetsListPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = (
        <ToolbarCreateButton label="Nuevo Presupuesto" href="/finances/budgets/list?modal=new" />
    )

    return <BudgetsListView externalOpen={modal === 'new'} createAction={createAction} />
}
