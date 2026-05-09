import { StockMoveDetailClient } from "@/features/inventory/components/StockMoveDetailClient"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Detalle de Movimiento | ERP",
    description: "Ver detalle de movimiento de stock",
}

export default function StockMoveDetailPage({ params }: { params: { id: string } }) {
    return <StockMoveDetailClient moveId={params.id} />
}
