"use client"

import React from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormFooter, CancelButton, SkeletonShell } from "@/components/shared"
import { StatusBadge } from "@/components/shared/StatusBadge"
import type { Task } from "@/features/workflow/api/workflowApi"
import { useTask } from "../hooks/useWorkflowQueries"

interface TaskDetailClientProps {
    taskId: string
}

const TASK_SKELETON: Task = {
    id: 0,
    title: "————————————",
    description: "————————————",
    task_type: "————————————",
    status: "PENDING",
    priority: "MEDIUM",
    assigned_to: null,
    assigned_to_data: { id: 0, username: "————————————" },
    assigned_group_name: "————————————",
    created_by: null,
    created_by_data: { id: 0, username: "————————————" },
    created_at: "",
    due_date: "",
    completed_at: "",
    completed_by: null
}

export function TaskDetailClient({ taskId }: TaskDetailClientProps) {
    const router = useRouter()
    const { data: task, isLoading, error: queryError } = useTask(taskId)

    const statusCode = queryError ? (queryError as any).response?.status || 500 : null

    if (statusCode === 404) return notFound()
    if (queryError) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
                Error al cargar tarea
            </div>
        )
    }

    if (isLoading || !task) {
        return (
            <div className="flex-1 p-8">
                <SkeletonShell isLoading={true} ariaLabel="Cargando detalle de tarea" />
            </div>
        )
    }

    const displayId = task.title

    return (
        <EntityDetailPage
            entityType="task"
            title="Tarea del Sistema"
            displayId={displayId}
            icon="circle-check"
            breadcrumb={[
                { label: "Tareas", href: "/workflow/tasks" },
                { label: displayId, href: `/workflow/tasks/${taskId}` },
            ]}
            instanceId={parseInt(taskId)}
            readonly={true}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.back()}>Volver</CancelButton>
                        </>
                    }
                />
            }
        >
            <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-2">
                        <p className="text-sm text-muted-foreground">Título</p>
                        <p className="font-semibold text-lg">{task.title}</p>
                    </div>
                    <div className="space-y-2 col-span-2">
                        <p className="text-sm text-muted-foreground">Descripción</p>
                        <p className="font-semibold">{task.description || "—"}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Estado</p>
                        <div>
                            <StatusBadge status={task.status} size="sm" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Asignado a</p>
                        <p className="font-semibold">
                            {task.assigned_to_data?.username || task.assigned_group_name || "—"}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Prioridad</p>
                        <p className="font-semibold">{task.priority || "—"}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Fecha de Creación</p>
                        <p className="font-semibold">
                            {task.created_at ? new Date(task.created_at).toLocaleString() : "—"}
                        </p>
                    </div>
                </div>
            </div>
        </EntityDetailPage>
    )
}
