import { redirect } from "next/navigation"

import { searchableEntityRoutes } from "@/lib/searchableEntityRoutes"

interface PageProps {
    params: Promise<{ id: string }>
}

/** Enlace antiguo: la ejecución vive en la lista como pestaña `variant="execution"` (ADR-0152). */
export default async function BudgetDetailPage({ params }: PageProps) {
    const { id } = await params
    redirect(`${searchableEntityRoutes["accounting.budget"]}?selected=${id}&action=execution`)
}
