import { MovementClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function StockMovementsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nuevo Ajuste" href="/inventory/stock/movements?modal=adjustment" />

    return (
        <MovementClientView
            externalOpen={modal === 'adjustment'}
            createAction={createAction}
        />
    )
}
