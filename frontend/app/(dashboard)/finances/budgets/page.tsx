import { BudgetsListView } from "@/features/finance/components/BudgetsListView"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

interface BudgetsPageProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export default function BudgetsPage({ externalOpen, onExternalOpenChange }: BudgetsPageProps) {
    return (
        <div className="pt-2">
            <BudgetsListView externalOpen={externalOpen} onExternalOpenChange={onExternalOpenChange} />
        </div>
    )
}
