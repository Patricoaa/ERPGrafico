import { PageSectionHeader } from "@/components/shared"
import { BudgetVarianceView } from "@/features/finance"

export default async function BudgetsVersusPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Variación Presupuestaria" description="Comparación entre presupuesto y ejecución real" />
            <BudgetVarianceView />
        </>)
}
