import type { Metadata } from "next"
import { PricingRuleClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"
import { getInventoryProductsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryProductsSubTab("pricing-rules")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Reglas de Precios | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function ProductsPricingRulesPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const createAction = <ToolbarCreateButton label="Nueva Regla" href="/inventory/products/pricing-rules?modal=new" />

  return (
    <>
      <PricingRuleClientView
        externalOpen={modal === 'new'}
        createAction={createAction}
      />
    </>
  )
}