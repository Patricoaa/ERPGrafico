import { BudgetDetail } from "@/features/finance"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function BudgetDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <div className="flex-1 space-y-4">
            <BudgetDetail budgetId={id} />
        </div>
    )
}