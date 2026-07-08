import { PageSectionHeader } from "@/components/shared"
import { BudgetVarianceView } from "@/features/finance"

export default async function BudgetsVersusPage() {
    return (
        <>
            <PageSectionHeader title="Variación Presupuestaria" description="Comparación entre presupuesto y ejecución real" />
            <BudgetVarianceView />
        </>)
}
