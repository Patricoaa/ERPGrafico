import { PricingRuleClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ProductsPricingRulesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nueva Regla" href="/inventory/products/pricing-rules?modal=new" />

    return (
        <PricingRuleClientView
            externalOpen={modal === 'new'}
            createAction={createAction}
        />
    )
}
