import { WarehouseClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function SettingsWarehousesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nuevo Almacén" href="/inventory/settings/warehouses?modal=new" />

    return (
        <>
            <WarehouseClientView
                externalOpen={modal === 'new'}
                createAction={createAction}
            />
        </>)
}
