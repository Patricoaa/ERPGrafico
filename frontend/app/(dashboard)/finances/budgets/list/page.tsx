import type { Metadata } from "next"
import { BudgetsClientView } from "@/features/finance"
import { PageSectionHeader, ToolbarCreateButton } from '@/components/shared'

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

    return (
        <>
            <PageSectionHeader title="Presupuestos" description="Planificación y control presupuestario" />
            <BudgetsClientView externalOpen={modal === 'new'} createAction={createAction} />
        </>)
}
