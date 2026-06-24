import { PageSectionHeader } from "@/components/shared"
import { BudgetDetail } from "@/features/finance"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function BudgetDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <div className="flex-1 space-y-4">
            <PageSectionHeader title="Detalle de Presupuesto" description="Visualización detallada del presupuesto" />
            <BudgetDetail budgetId={id} />
        </div>
    )
}