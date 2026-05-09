import { WarehouseDetailClient } from "@/features/inventory/components/WarehouseDetailClient"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Detalle de Bodega | ERP",
    description: "Ver y editar detalle de bodega",
}

export default function WarehouseDetailPage({ params }: { params: { id: string } }) {
    return <WarehouseDetailClient warehouseId={params.id} />
}
