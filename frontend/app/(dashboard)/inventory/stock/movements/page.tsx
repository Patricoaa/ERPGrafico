import { PageSectionHeader } from "@/components/shared"
import { MovementClientView } from "@/features/inventory"

export default async function StockMovementsPage() {
    return (
        <>
            <PageSectionHeader title="Movimientos de Stock" description="Histórico de movimientos generados por documentos de inventario" />
            <MovementClientView />
        </>
    )
}
