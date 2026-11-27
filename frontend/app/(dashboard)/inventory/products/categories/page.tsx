import type { Metadata } from "next"
import { CategoryClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"
import { getInventoryProductsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryProductsSubTab("categories")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Categorías de Productos | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function ProductsCategoriesPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const createAction = <ToolbarCreateButton label="Nueva Categoría" href="/inventory/products/categories?modal=new" />

  return (
    <CategoryClientView
      externalOpen={modal === "new"}
      createAction={createAction}
    />
  )
}
