import { ProductDetailClient } from "@/features/inventory/components/ProductDetailClient"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Detalle de Producto | ERP",
    description: "Ver y editar detalle de producto",
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
    return <ProductDetailClient productId={params.id} />
}
