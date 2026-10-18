import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import { WarehouseClientView } from "@/features/inventory"
import { getInventoryOperationsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryOperationsSubTab("warehouses")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Almacenes y Ubicaciones | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function StockWarehousesPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const createAction = <ToolbarCreateButton label="Nuevo Almacén" href="/inventory/operations/warehouses?modal=new" />

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <WarehouseClientView
        externalOpen={modal === 'new'}
        createAction={createAction}
      />
    </div>
  )
}