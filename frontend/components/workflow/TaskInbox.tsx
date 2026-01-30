"use client"

import { useState, useEffect } from "react"
import { getTasks, Task } from "@/lib/workflow/api"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, ListTodo, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function TaskInbox() {
    const [approvalTasks, setApprovalTasks] = useState<Task[]>([])
    const [operationalTasks, setOperationalTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("approvals")
    const [approvalsExpanded, setApprovalsExpanded] = useState(true)
    const [completedExpanded, setCompletedExpanded] = useState(false)
    const { openWorkOrder, openCommandCenter } = useGlobalModals()

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
        // Refresh every 60s for new tasks
        const interval = setInterval(fetchTasks, 60000)
        return () => clearInterval(interval)
    }, [])

    const navigateToTask = (task: Task) => {
        // Smart navigation based on task type
        if (!task.object_id) {
            toast.error("No se encontró el documento asociado")
            return
        }

        if (task.task_type?.includes('OT_')) {
            // Work Order approval tasks
            openWorkOrder(task.object_id)
        } else if (task.task_type?.includes('OC_')) {
            // Purchase Order tasks
            openCommandCenter(task.object_id, 'purchase')
        } else if (task.task_type?.includes('OV_')) {
            // Sale Order tasks
            openCommandCenter(task.object_id, 'sale')
        } else if (task.task_type?.includes('NC_') || task.task_type?.includes('ND_')) {
            // Credit/Debit notes - determine type from context
            // For now, default to 'sale' - could be enhanced based on task metadata
            openCommandCenter(task.object_id, 'sale')
        } else {
            // Generic fallback
            toast.info("Navegación específica no configurada para este tipo de tarea")
        }
    }

    const getUserInitials = (task: Task): string => {
        const user = task.assigned_to_data
        if (!user) return "??"

        if (user.first_name && user.last_name) {
            return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
        }

        if (user.username) {
            return user.username.substring(0, 2).toUpperCase()
        }

        return "??"
    }

    const getDocumentId = (task: Task): string => {
        // Extract document ID from task metadata
        if (task.object_id) {
            // Try to infer document type from task_type
            if (task.task_type?.includes('OT_') || task.title?.includes('OT-')) return `OT-${task.object_id}`
            if (task.task_type?.includes('OC_') || task.title?.includes('OC-')) return `OC-${task.object_id}`
            if (task.task_type?.includes('OV_') || task.title?.includes('OV-')) return `OV-${task.object_id}`
            if (task.task_type?.includes('NC_')) return `NC-${task.object_id}`
            if (task.task_type?.includes('ND_')) return `ND-${task.object_id}`

            return `#${task.object_id}`
        }
        return "Sin documento"
    }

    const renderTaskCard = (task: Task) => {
        const isCompleted = task.status === 'COMPLETED'
        const initials = getUserInitials(task)
        const docId = getDocumentId(task)

        return (
            <Card
                key={task.id}
                className={cn(
                    "p-3 transition-all cursor-pointer border-sidebar-border/50 bg-white/5 hover:bg-white/10 hover:border-primary/50 hover:shadow-lg backdrop-blur-sm group",
                    isCompleted && "opacity-50 grayscale-[0.5]"
                )}
                onClick={() => navigateToTask(task)}
            >
                {/* Row 1: Task Name | Avatar */}
                <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="text-sm font-medium text-slate-100 line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                        {task.title}
                    </h3>
                    <Avatar className="h-8 w-8 shrink-0 border border-primary/20">
                        <AvatarFallback className="text-xs bg-primary/20 text-primary font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </div>

                {/* Row 2: Document ID */}
                <div className="flex items-center justify-between text-[11px] font-medium tracking-tight">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-mono">
                        {docId}
                    </span>
                    <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-200 transition-colors">
                        {isCompleted ? (
                            <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Completada</span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <span>Pendiente</span>
                            </span>
                        )}
                    </div>
                </div>
            </Card>
        )
    }

    const approvalsPending = approvalTasks.filter(t => t.status === 'PENDING')
    const approvalsCompleted = approvalTasks.filter(t => t.status === 'COMPLETED')

    const CollapsibleSection = ({
        title,
        count,
        expanded,
        onToggle,
        children
    }: {
        title: string
        count: number
        expanded: boolean
        onToggle: () => void
        children: React.ReactNode
    }) => (
        <div className="mb-4">
            <button
                onClick={onToggle}
                className="flex items-center justify-between w-full p-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors rounded-lg hover:bg-sidebar-accent"
            >
                <span>{title} ({count})</span>
                {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                ) : (
                    <ChevronRight className="h-4 w-4" />
                )}
            </button>
            {expanded && (
                <div className="mt-2 space-y-2">
                    {children}
                </div>
            )}
        </div>
    )

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 p-1 border border-slate-700/50 backdrop-blur-md rounded-xl">
                    <TabsTrigger
                        value="approvals"
                        className="gap-2 text-xs rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Aprobaciones</span>
                        <span className="sm:hidden">Aprob.</span>
                        <span className="opacity-70 text-[10px] ml-1 px-1.5 py-0.5 bg-background/20 rounded-full">
                            {approvalsPending.length}
                        </span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="tasks"
                        className="gap-2 text-xs rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
                    >
                        <ListTodo className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Tareas Operativas</span>
                        <span className="sm:hidden">Tareas</span>
                        <span className="opacity-70 text-[10px] ml-1 px-1.5 py-0.5 bg-background/20 rounded-full">
                            {operationalTasks.length}
                        </span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="approvals" className="mt-4">
                    {loading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-20 rounded-lg bg-muted/20 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <>
                            {approvalsPending.length > 0 && (
                                <CollapsibleSection
                                    title="Pendientes"
                                    count={approvalsPending.length}
                                    expanded={approvalsExpanded}
                                    onToggle={() => setApprovalsExpanded(!approvalsExpanded)}
                                >
                                    {approvalsPending.map(task => renderTaskCard(task))}
                                </CollapsibleSection>
                            )}

                            {approvalsCompleted.length > 0 && (
                                <CollapsibleSection
                                    title="Completadas"
                                    count={approvalsCompleted.length}
                                    expanded={completedExpanded}
                                    onToggle={() => setCompletedExpanded(!completedExpanded)}
                                >
                                    {approvalsCompleted.slice(0, 10).map(task => renderTaskCard(task))}
                                </CollapsibleSection>
                            )}

                            {approvalTasks.length === 0 && (
                                <div className="text-center py-12 bg-muted/10 rounded-lg border border-dashed text-muted-foreground">
                                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-xs">No tienes aprobaciones</p>
                                </div>
                            )}
                        </>
                    )}
                </TabsContent>

                <TabsContent value="tasks" className="mt-4">
                    {loading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-20 rounded-lg bg-muted/20 animate-pulse" />
                            ))}
                        </div>
                    ) : operationalTasks.length === 0 ? (
                        <div className="text-center py-12 bg-muted/10 rounded-lg border border-dashed text-muted-foreground">
                            <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p className="text-xs">No tienes tareas pendientes</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {operationalTasks.map(task => renderTaskCard(task))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
