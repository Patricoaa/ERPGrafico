import type { Metadata } from "next"
import { AttributesClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"
import { getInventoryProductsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryProductsSubTab("attributes")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Atributos de Variantes | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function ProductsAttributesPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const createAction = <ToolbarCreateButton label="Nuevo Atributo" href="/inventory/products/attributes?modal=new" />

  return (
    <>
      <AttributesClientView
        externalOpen={modal === 'new'}
        createAction={createAction}
      />
    </>
  )
}