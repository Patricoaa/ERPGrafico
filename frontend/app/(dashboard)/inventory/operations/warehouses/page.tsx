import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import { WarehouseClientView } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Almacenes | ERPGrafico",
}

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
