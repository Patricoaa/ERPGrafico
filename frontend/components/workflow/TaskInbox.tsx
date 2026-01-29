"use client"

import { useState, useEffect } from "react"
import { getTasks, Task } from "@/lib/workflow/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, CheckCircle2, ListTodo, FileClock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function TaskInbox() {
    const [approvalTasks, setApprovalTasks] = useState<Task[]>([])
    const [operationalTasks, setOperationalTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [activeTab, setActiveTab] = useState("approvals")
    const router = useRouter()

    const fetchTasks = async () => {
        setLoading(true)
        try {
            // Fetch approval tasks (pending + completed for audit trail)
            const approvalsRes = await getTasks({ category: 'APPROVAL' })
            const approvals = Array.isArray(approvalsRes) ? approvalsRes : (approvalsRes.results || [])
            setApprovalTasks(approvals)

            // Fetch operational tasks (only pending and active)
            const tasksRes = await getTasks({ category: 'TASK', status: 'PENDING' })
            const tasks = Array.isArray(tasksRes) ? tasksRes : (tasksRes.results || [])
            setOperationalTasks(tasks)
        } catch (error) {
            toast.error("Error al cargar tareas")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTasks()
        // Refresh every 30s for new tasks
        const interval = setInterval(fetchTasks, 30000)
        return () => clearInterval(interval)
    }, [])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchTasks()
    }

    const navigateToTask = (task: Task) => {
        // Smart navigation based on task type
        if (task.task_type?.includes('OT_')) {
            // Work Order approval tasks
            if (task.object_id) {
                router.push(`/production/orders/${task.object_id}`)
            }
        } else if (task.task_type?.includes('OC_')) {
            // Purchase Order tasks
            if (task.object_id) {
                router.push(`/purchasing/orders/${task.object_id}`)
            }
        } else {
            // Generic navigation for future task types
            toast.info("Navegación específica no configurada para este tipo de tarea")
        }
    }

    const renderTaskCard = (task: Task, isApproval: boolean) => {
        const isCompleted = task.status === 'COMPLETED'
        const priorityVariant = task.priority === 'HIGH' || task.priority === 'CRITICAL' ? 'destructive' : 'secondary'

        return (
            <Card
                key={task.id}
                className={`group transition-all ${isCompleted ? 'opacity-60' : 'hover:border-primary/50 cursor-pointer'}`}
                onClick={() => navigateToTask(task)}
            >
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1 flex-1">
                            <CardTitle className="text-base font-semibold line-clamp-1 flex items-center gap-2">
                                {task.title}
                                {isCompleted && (
                                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                )}
                            </CardTitle>
                            <CardDescription className="text-xs">{task.task_type}</CardDescription>
                        </div>
                        <Badge variant={priorityVariant} className="text-[10px] uppercase shrink-0">
                            {task.priority}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {task.description}
                    </p>

                    <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                        {task.assigned_to_data && (
                            <div className="flex items-center gap-1">
                                <span className="font-medium">Asignado a:</span>
                                <span>{task.assigned_to_data.username}</span>
                            </div>
                        )}

                        {isCompleted && task.completed_by_data && (
                            <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                <span className="font-medium">Completada por:</span>
                                <span>{task.completed_by_data.username}</span>
                            </div>
                        )}

                        {isCompleted && task.completed_at && (
                            <div className="text-green-600">
                                {new Date(task.completed_at).toLocaleString()}
                            </div>
                        )}

                        {!isCompleted && (
                            <div>
                                Creada: {new Date(task.created_at).toLocaleDateString()}
                            </div>
                        )}
                    </div>

                    {!isApproval && !isCompleted && (
                        <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                                <FileClock className="h-3 w-3" />
                                {isApproval
                                    ? "Se completará automáticamente al avanzar la etapa"
                                    : "Completa la acción en el Hub de Mandos"}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    const approvalsPending = approvalTasks.filter(t => t.status === 'PENDING')
    const approvalsCompleted = approvalTasks.filter(t => t.status === 'COMPLETED')

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Bandeja de Tareas</h2>
                    <p className="text-muted-foreground">Gestiona tus aprobaciones y asignaciones pendientes.</p>
                </div>
                <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar tarea..."
                            className="pl-9 w-[300px]"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </form>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-[500px] grid-cols-2">
                    <TabsTrigger value="approvals" className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Aprobaciones ({approvalsPending.length})
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="gap-2">
                        <ListTodo className="h-4 w-4" />
                        Tareas Pendientes ({operationalTasks.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="approvals" className="mt-6">
                    {loading ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-48 rounded-xl bg-muted/20 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <>
                            {approvalsPending.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                        Pendientes
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {approvalsPending.map(task => renderTaskCard(task, true))}
                                    </div>
                                </div>
                            )}

                            {approvalsCompleted.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                        Completadas (Auditoría)
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {approvalsCompleted.slice(0, 6).map(task => renderTaskCard(task, true))}
                                    </div>
                                </div>
                            )}

                            {approvalTasks.length === 0 && (
                                <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed text-muted-foreground">
                                    <CheckCircle2 className="h-10 w-10 mx-auto mb-4 opacity-20" />
                                    <p>No tienes aprobaciones en tu bandeja.</p>
                                </div>
                            )}
                        </>
                    )}
                </TabsContent>

                <TabsContent value="tasks" className="mt-6">
                    {loading ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-48 rounded-xl bg-muted/20 animate-pulse" />
                            ))}
                        </div>
                    ) : operationalTasks.length === 0 ? (
                        <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed text-muted-foreground">
                            <ListTodo className="h-10 w-10 mx-auto mb-4 opacity-20" />
                            <p>No tienes tareas operativas pendientes.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {operationalTasks.map(task => renderTaskCard(task, false))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
