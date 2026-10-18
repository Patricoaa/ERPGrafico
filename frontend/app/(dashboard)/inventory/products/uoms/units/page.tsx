"use client"

import { UoMClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"
import { getInventoryProductsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryProductsSubTab("uoms")
export const metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Unidades de Medida | ERPGrafico" }

export default function UoMUnitsPage() {
  const createAction = <ToolbarCreateButton label="Nueva Unidad" href="/inventory/products/uoms/units?modal=new" />

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <UoMClientView createAction={createAction} />
    </div>
  )
}