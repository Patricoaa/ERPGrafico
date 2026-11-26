import { redirect } from "next/navigation"

import { searchableEntityRoutes } from "@/lib/searchableEntityRoutes"

interface PageProps {
    params: Promise<{ id: string }>
}

/** Enlace antiguo: la ficha admin vive en la pestaña de la lista (ADR-0152). */
export default async function PayrollDetailPage({ params }: PageProps) {
    const { id } = await params
    redirect(`${searchableEntityRoutes["hr.payroll"]}?selected=${id}`)
}
