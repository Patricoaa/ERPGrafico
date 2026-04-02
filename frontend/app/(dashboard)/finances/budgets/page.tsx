import { BudgetsListView } from "@/features/finance/components/BudgetsListView"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

export default function BudgetsPage() {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Presupuestos"
                description="Control de metas presupuestarias y ejecución por centro de costos."
                iconName="target"
                variant="minimal"
            />
            <BudgetsListView />
        </div>
    )
}
