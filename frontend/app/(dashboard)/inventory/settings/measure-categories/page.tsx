"use client"

import { UoMCategoryClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"
import { getInventoryConfigSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryConfigSubTab("measure-categories")
export const metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Categorías de Medidas | ERPGrafico" }

export default function InventorySettingsMeasureCategoriesPage() {
  const createAction = <ToolbarCreateButton label="Nueva Categoría" href="/inventory/settings/measure-categories?modal=new" />

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <UoMCategoryClientView createAction={createAction} />
    </div>
  )
}