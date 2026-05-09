import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { EmployeeDetailClient } from "@/features/hr/components/EmployeeDetailClient"

export const metadata: Metadata = {
    title: "Empleado | ERP Gráfico",
    description: "Ficha de empleado.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EmployeeDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <EmployeeDetailClient employeeId={id} />
        </Suspense>
    )
}
