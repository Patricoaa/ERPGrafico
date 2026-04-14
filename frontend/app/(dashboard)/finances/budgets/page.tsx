import { BudgetsListView } from "@/features/finance/components/BudgetsListView"
import { BudgetVarianceView } from "@/features/finance/components/BudgetVarianceView"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

interface BudgetsPageProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    tab?: string
}

export default function BudgetsPage({ externalOpen, onExternalOpenChange, tab }: BudgetsPageProps) {
    return (
        <div className="pt-2">
            {tab === 'versus' ? (
                <BudgetVarianceView />
            ) : (
                <BudgetsListView externalOpen={externalOpen} onExternalOpenChange={onExternalOpenChange} />
            )}
        </div>
    )
}
