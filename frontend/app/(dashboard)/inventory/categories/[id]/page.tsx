import { CategoryDetailClient } from "@/features/inventory/components/CategoryDetailClient"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Detalle de Categoría | ERP",
    description: "Ver y editar detalle de categoría",
}

export default function CategoryDetailPage({ params }: { params: { id: string } }) {
    return <CategoryDetailClient categoryId={params.id} />
}
