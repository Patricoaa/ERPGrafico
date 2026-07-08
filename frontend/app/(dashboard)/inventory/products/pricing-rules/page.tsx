import { PageSectionHeader } from "@/components/shared"
import { PricingRuleClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ProductsPricingRulesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nueva Regla" href="/inventory/products/pricing-rules?modal=new" />

    return (
        <>
            <PageSectionHeader title="Reglas de Precios" description="Configuración de márgenes y políticas de precios" />
            <PricingRuleClientView
                externalOpen={modal === 'new'}
                createAction={createAction}
            />
        </>)
}
