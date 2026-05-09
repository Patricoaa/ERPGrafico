import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { TaskDetailClient } from "@/features/workflow/components/TaskDetailClient"

export const metadata: Metadata = {
    title: "Tarea | ERP Gráfico",
    description: "Detalle de tarea del sistema.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function TaskDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <TaskDetailClient taskId={id} />
        </Suspense>
    )
}
