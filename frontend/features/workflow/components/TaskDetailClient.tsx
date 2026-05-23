"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormFooter, CancelButton, SkeletonShell } from "@/components/shared"
import api from "@/lib/api"
import { StatusBadge } from "@/components/shared/StatusBadge"
import type { Task } from "@/features/workflow/api/workflowApi"

// Placeholder tipado para el esqueleto - sigue el patrón del contrato
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
    const [task, setTask] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)

    useEffect(() => {
        const fetchTask = async () => {
            try {
                // Workflow tasks are typically in /workflow/tasks/
                const response = await api.get(`/workflow/tasks/${taskId}/`)
                setTask(response.data)
            } catch (err: any) {
                setError(err.response?.status || 500)
            } finally {
                setLoading(false)
            }
        }
        fetchTask()
    }, [taskId])

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar tarea
        </div>
    )

    // Estado de carga manejado con SkeletonShell
    return (
        <SkeletonShell isLoading={loading || !task} ariaLabel="Cargando detalle de tarea">
            <EntityDetailPage
                entityType="task"
                title="Tarea del Sistema"
                displayId={(task ?? TASK_SKELETON).title}
                icon="circle-check"
                breadcrumb={[
                    { label: "Tareas", href: "/workflow/tasks" }, // Tareas usually points to an inbox
                    { label: (task ?? TASK_SKELETON).title, href: `/workflow/tasks/${taskId}` },
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
                            <p className="font-semibold text-lg">{task?.title ?? TASK_SKELETON.title}</p>
                        </div>
                        <div className="space-y-2 col-span-2">
                            <p className="text-sm text-muted-foreground">Descripción</p>
                            <p className="font-semibold">{(task?.description ?? TASK_SKELETON.description) || "—"}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Estado</p>
                            <div>
                                <StatusBadge status={(task?.status ?? TASK_SKELETON.status)} size="sm" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Asignado a</p>
                            <p className="font-semibold">{(task?.assigned_to_data?.username ?? TASK_SKELETON.assigned_to_data?.username) || (task?.assigned_group_name ?? TASK_SKELETON.assigned_group_name) || "—"}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Prioridad</p>
                            <p className="font-semibold">{(task?.priority ?? TASK_SKELETON.priority) || "—"}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Fecha de Creación</p>
                            <p className="font-semibold">{new Date((task?.created_at ?? TASK_SKELETON.created_at) || "").toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </EntityDetailPage>
        </SkeletonShell>
    )

    const displayId = task.title

    return (
        <EntityDetailPage
            entityType="task"
            title="Tarea del Sistema"
            displayId={displayId}
            icon="circle-check"
            breadcrumb={[
                { label: "Tareas", href: "/workflow/tasks" }, // Tareas usually points to an inbox
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
                        <p className="font-semibold">{task.assigned_to_name || task.assigned_group_name || "—"}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Prioridad</p>
                        <p className="font-semibold">{task.priority || "—"}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Fecha de Creación</p>
                        <p className="font-semibold">{new Date(task.created_at).toLocaleString()}</p>
                    </div>
                </div>
            </div>
        </EntityDetailPage>
    )
}
