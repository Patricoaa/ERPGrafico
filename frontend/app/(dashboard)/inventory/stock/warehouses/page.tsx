import { PageSectionHeader } from "@/components/shared"
import { WarehouseClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function StockWarehousesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nuevo Almacén" href="/inventory/stock/warehouses?modal=new" />

    return (
        <>
            <PageSectionHeader title="Almacenes" description="Gestión de bodegas y ubicaciones de stock" />
            <WarehouseClientView
                externalOpen={modal === 'new'}
                createAction={createAction}
            />
        </>)
}
