"use client"
import { formatPlainDate } from "@/lib/utils";
import { useState, useEffect, useMemo, useCallback } from "react"
import { getTasks, type Task } from '@/features/workflow/api/workflowApi'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TabBar, TabBarContent, type TabItem } from "@/components/shared"
import {CheckCircle2, ListTodo, ChevronDown, ChevronRight, User, ExternalLink, Package, FileText, Wallet, TrendingUp, Calendar, ArrowRight, ChevronUp} from "lucide-react"
import { toast } from "sonner"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

import { cn } from "@/lib/utils"
import { useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { MoneyDisplay } from "@/components/shared"
import { useAuth } from "@/contexts/AuthContext"
import {formatEntityDisplay} from "@/lib/entity-registry"
import { useUpdateTask } from "../hooks/useWorkflowMutations"

const HUB_STAGE_LABELS: Record<string, string> = {
    origin: 'Origen',
    logistics: 'Logística',
    billing: 'Facturación',
    treasury: 'Tesorería',
}

type TaskGroup = 'hub' | 'document' | 'credit' | 'accounting' | 'other'

const GROUP_LABELS: Record<TaskGroup, string> = {
    hub: 'Procesar Etapa',
    document: 'Aprobar Documento',
    credit: 'Evaluar Crédito',
    accounting: 'Cierre Contable',
    other: 'Otras Acciones',
}

function getTaskGroup(task: Task): TaskGroup {
    const t = task.task_type || ''
    if (t.startsWith('HUB_')) return 'hub'
    if (t.startsWith('OT_') || t.startsWith('OV_') || t.startsWith('OC_') || t.startsWith('NC_') || t.startsWith('ND_')) return 'document'
    if (t === 'CREDIT_POS_REQUEST') return 'credit'
    if (t.startsWith('F29_') || t === 'PERIOD_CLOSE') return 'accounting'
    return 'other'
}

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
            className="flex items-center justify-between w-full p-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
        >
            <span>{title} ({count})</span>
            {expanded ? (
                <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            ) : (
                <ChevronRight className="h-4 w-4 transition-transform duration-200" />
            )}
        </button>
        <div
            className={cn(
                "mt-2 space-y-2 overflow-hidden transition-all duration-200 ease-out",
                expanded ? "animate-in fade-in slide-in-from-top-1" : "max-h-0 opacity-0"
            )}
        >
            {expanded && children}
        </div>
    </div>
)

function TaskSkeleton() {
    return (
        <Card className="card-base p-3 backdrop-blur-sm">
            <div className="h-4 bg-muted/50 rounded w-3/5 animate-pulse" />
            <div className="h-3 bg-muted/30 rounded w-2/5 animate-pulse mt-3" />
        </Card>
    )
}

interface TaskInboxProps {
    onCountChange?: (counts: { total: number; approvals: number; tasks: number }) => void
}

export function TaskInbox({ onCountChange }: TaskInboxProps) {
    const [approvalTasks, setApprovalTasks] = useState<Task[]>([])
    const [operationalTasks, setOperationalTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [actioningTask, setActioningTask] = useState<number | null>(null)
    const [activeTab, setActiveTab] = useState("approvals")
    const [approvalsExpanded, setApprovalsExpanded] = useState(true)
    const [completedExpanded, setCompletedExpanded] = useState(false)
    const [hubExpandedTasks, setHubExpandedTasks] = useState<Set<number>>(new Set())
    const [groupExpanded, setGroupExpanded] = useState<Record<TaskGroup, boolean>>({
        hub: true, document: true, credit: true, accounting: true, other: true,
    })
    const { openEntity } = useGlobalModalActions()
    const { openHub } = useHubPanel()
    const { user } = useAuth()
    const searchParams = useSearchParams()
    const router = useRouter()
    const selectedId = searchParams.get('selected')

    const lastApprovalsCount = useRef<number | null>(null)
    const lastTasksCount = useRef<number | null>(null)

    const fetchTasks = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            const approvalsRes = await getTasks({ category: 'APPROVAL' })
            const approvals = Array.isArray(approvalsRes) ? approvalsRes : (approvalsRes.results || [])
            setApprovalTasks(approvals)

            const tasksRes = await getTasks({ category: 'TASK', status: 'PENDING' })
            const tasks = Array.isArray(tasksRes) ? tasksRes : (tasksRes.results || [])
            setOperationalTasks(tasks)

            const currentPendingApprovals = approvals.filter((t: Task) => t.status === 'PENDING').length
            const currentPendingTasks = tasks.length

            if (silent) {
                if (lastApprovalsCount.current !== null && currentPendingApprovals > lastApprovalsCount.current) {
                    toast.success("Nueva aprobación recibida", {
                        description: "Tienes una nueva solicitud pendiente de revisión.",
                        duration: 5000,
                    })
                }
                if (lastTasksCount.current !== null && currentPendingTasks > lastTasksCount.current) {
                    toast.info("Nueva tarea recibida", {
                        description: "Se ha asignado una nueva tarea operativa a tu bandeja.",
                        duration: 5000,
                    })
                }
            }

            lastApprovalsCount.current = currentPendingApprovals
            lastTasksCount.current = currentPendingTasks

        } catch {
            if (!silent) toast.error("Error al cargar tareas")
        } finally {
            if (!silent) setLoading(false)
        }
    }, [])

    useEffect(() => {
        const handle = requestAnimationFrame(() => {
            fetchTasks()
        })
        const interval = setInterval(() => {
            fetchTasks(true)
        }, 30000)
        return () => {
            cancelAnimationFrame(handle)
            clearInterval(interval)
        }
    }, [fetchTasks])

    const approvalsPending = approvalTasks.filter(t => t.status === 'PENDING')
    const approvalsCompleted = approvalTasks.filter(t => t.status !== 'PENDING')

    useEffect(() => {
        onCountChange?.({
            total: approvalsPending.length + operationalTasks.length,
            approvals: approvalsPending.length,
            tasks: operationalTasks.length,
        })
    }, [approvalsPending.length, operationalTasks.length, onCountChange])

    const groupedOperational = useMemo(() => {
        const groups: Record<TaskGroup, Task[]> = { hub: [], document: [], credit: [], accounting: [], other: [] }
        for (const task of operationalTasks) {
            groups[getTaskGroup(task)].push(task)
        }
        return Object.entries(groups).filter(([, tasks]) => tasks.length > 0) as [TaskGroup, Task[]][]
    }, [operationalTasks])

    const navigateToTask = (task: Task) => {
        if (!task.object_id) {
            toast.error("No se encontró el documento asociado")
            return
        }

        if (task.task_type === 'OT_CREATION') {
            const saleOrderId = task.data?.sale_order_id || (task.data?.order_type === 'sale' ? task.object_id : null)
            if (saleOrderId) {
                openHub({ orderId: saleOrderId, type: 'sale', onActionSuccess: () => fetchTasks() })
            } else {
                openEntity('production.workorder', task.object_id)
            }
        } else if (task.task_type?.includes('OT_')) {
            openEntity('production.workorder', task.object_id)
        } else if (task.task_type?.includes('OC_')) {
            openHub({ orderId: task.object_id, type: 'purchase', onActionSuccess: () => fetchTasks() })
        } else if (task.task_type?.includes('OV_')) {
            openHub({ orderId: task.object_id, type: 'sale', onActionSuccess: () => fetchTasks() })
        } else if (task.task_type?.includes('NC_') || task.task_type?.includes('ND_')) {
            openHub({ orderId: task.object_id, type: 'sale', onActionSuccess: () => fetchTasks() })
        } else if (task.task_type?.startsWith('HUB_')) {
            const orderType = (task.data?.order_type as 'purchase' | 'sale' | 'obligation') || 'sale'
            if (task.data?.is_invoice || task.task_type?.includes('_NC_') || task.task_type?.includes('_ND_')) {
                openHub({ orderId: null, invoiceId: task.object_id, type: orderType, onActionSuccess: () => fetchTasks() })
            } else {
                openHub({ orderId: task.object_id, type: orderType, onActionSuccess: () => fetchTasks() })
            }
        } else if (task.task_type === 'CREDIT_POS_REQUEST') {
            toast.info("Usando vista rápida de aprobación (Click en el botón, no en la tarjeta)");
            return
        } else if (task.task_type === 'F29_CREATE' || task.task_type === 'F29_PAY') {
            const year = task.data?.year || ''
            const month = task.data?.month || ''
            const action = task.task_type === 'F29_PAY' ? 'pay' : 'create'
            window.location.href = `/accounting?view=tax&year=${year}&month=${month}&action=${action}`
        } else if (task.task_type === 'PERIOD_CLOSE') {
            const year = task.data?.year || ''
            const month = task.data?.month || ''
            window.location.href = `/accounting/periods?year=${year}&month=${month}`
        } else {
            toast.info("Navegación específica no configurada para este tipo de tarea")
        }
    }

    useEffect(() => {
        if (selectedId && !loading) {
            const task = [...approvalTasks, ...operationalTasks].find(t => t.id === parseInt(selectedId))
            if (task) {
                navigateToTask(task)
                const params = new URLSearchParams(searchParams.toString())
                params.delete('selected')
                router.replace(`?${params.toString()}`, { scroll: false })
            }
        }
    }, [selectedId, loading, approvalTasks, operationalTasks])

    const updateTaskMutation = useUpdateTask()

    const handleCreditAction = async (e: React.MouseEvent, task: Task, action: 'APPROVE' | 'REJECT') => {
        e.stopPropagation()
        try {
            setActioningTask(task.id)
            const status = action === 'APPROVE' ? 'COMPLETED' : 'REJECTED'
            const notes = action === 'APPROVE' ? 'Aprobado desde Inbox POS' : 'Rechazado desde Inbox POS'

            await updateTaskMutation.mutateAsync({
                id: task.id,
                payload: {
                    status,
                    notes: task.notes ? `${task.notes}\n${notes}` : notes
                }
            })

            toast.success(`Crédito ${action === 'APPROVE' ? 'Aprobado' : 'Rechazado'}`)
            fetchTasks()
        } catch {
            toast.error("Error al procesar la solicitud")
        } finally {
            setActioningTask(null)
        }
    }

    const formatShortDate = (dateStr?: string) => {
        if (!dateStr) return '-'
        return formatPlainDate(dateStr)
    }

    const toggleHubExpanded = (taskId: number) => {
        setHubExpandedTasks(prev => {
            const next = new Set(prev)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })
    }

    const renderTaskCard = (task: Task) => {
        const isRejected = task.status === 'REJECTED'
        const isHubTask = task.task_type?.startsWith('HUB_')
        const hubExpanded = hubExpandedTasks.has(task.id)
        const showDueDate = task.due_date

        return (
            <Card
                key={task.id}
                className={cn(
                    "card-base p-3 cursor-pointer backdrop-blur-sm group flex flex-col gap-3 w-full",
                    "transition-all duration-200 ease-out hover:shadow-sm hover:-translate-y-0.5",
                    isRejected && "opacity-50 grayscale-[0.5]"
                )}
                onClick={() => navigateToTask(task)}
            >
                {/* Row 1: Title + Hover Arrow */}
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-foreground line-clamp-2 flex-1 group-hover:text-primary transition-colors flex items-center gap-2">
                        {task.task_type === 'CREDIT_POS_REQUEST' ? (
                            `Aprobación Crédito: ${task.data?.customer_name || task.title.replace('Aprobación Crédito: ', '') || 'Cliente'}`
                        ) : task.task_type?.startsWith('HUB_') ? (
                            <>
                                {task.data?.stage === 'origin' && <TrendingUp className="h-4 w-4 text-muted-foreground/70 shrink-0" />}
                                {task.data?.stage === 'logistics' && <Package className="h-4 w-4 text-muted-foreground/70 shrink-0" />}
                                {task.data?.stage === 'billing' && <FileText className="h-4 w-4 text-muted-foreground/70 shrink-0" />}
                                {task.data?.stage === 'treasury' && <Wallet className="h-4 w-4 text-muted-foreground/70 shrink-0" />}
                                <span className="uppercase">{HUB_STAGE_LABELS[task.data?.stage as keyof typeof HUB_STAGE_LABELS] || task.data?.stage}</span>:
                                {' '}{formatEntityDisplay(task.data?.order_type === 'purchase' ? 'purchasing.purchaseorder' : 'sales.saleorder', { number: task.data?.order_number })}
                            </>
                        ) : (
                            task.title
                        )}
                    </h3>
                    <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-x-1 group-hover:translate-x-0 shrink-0" />
                </div>

                {/* HUB Stage Context (compact, expandable) */}
                {isHubTask && (
                    <div
                        className={cn(
                            "text-[11px] text-muted-foreground bg-muted/30 rounded-md border border-border/30 overflow-hidden transition-all duration-200",
                        )}
                    >
                        <div className="flex items-center justify-between gap-2 p-2">
                            <div className="flex items-center gap-2 min-w-0">
                                {task.data?.contact_name && (
                                    <span className="truncate font-medium text-foreground/80">
                                        {task.data.contact_name}
                                    </span>
                                )}
                                {task.data?.order_total && (
                                    <MoneyDisplay amount={task.data.order_total} className="text-success text-[11px]" />
                                )}
                            </div>
                            <button
                                className="shrink-0 text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
                                onClick={(e) => { e.stopPropagation(); toggleHubExpanded(task.id) }}
                            >
                                {hubExpanded ? 'Ocultar' : 'Ver más'}
                                {hubExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                        </div>
                        {hubExpanded && (
                            <div className="px-2 pb-2 space-y-1.5 border-t border-border/30 pt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                {task.data?.contact_name && (
                                    <div className="flex justify-between items-center">
                                        <span className="opacity-70">{task.data?.order_type === 'purchase' ? 'Proveedor:' : 'Cliente:'}</span>
                                        <span className="font-medium text-foreground">{task.data.contact_name}</span>
                                    </div>
                                )}
                                {task.data?.stage === 'logistics' ? (
                                    <div className="flex justify-between items-center">
                                        <span className="opacity-70">Fecha {task.data?.order_type === 'purchase' ? 'Recepción' : 'Entrega'}:</span>
                                        <span className="font-medium text-foreground">
                                            {task.data.delivery_date ? formatShortDate(task.data.delivery_date) : 'Pendiente'}
                                        </span>
                                    </div>
                                ) : task.data?.order_total ? (
                                    <div className="flex justify-between items-center">
                                        <span className="opacity-70">Total Orden:</span>
                                        <MoneyDisplay amount={task.data.order_total} className="text-success" />
                                    </div>
                                ) : null}
                                <div className="flex justify-between items-center pt-1 mt-1 border-t border-border/30">
                                    <span className="font-bold text-warning">Acción Requerida:</span>
                                    <span className="font-medium text-warning text-right">
                                        {task.data?.stage === 'logistics' && (task.data?.is_invoice ? 'Registrar Devolución' : 'Registrar Despacho')}
                                        {task.data?.stage === 'billing' && (task.data?.action_name ? `Registrar ${task.data.action_name}` : (task.data?.is_invoice ? 'Registrar Nota' : 'Registrar Factura'))}
                                        {task.data?.stage === 'treasury' && (task.data?.is_invoice && task.data?.prefix === 'NC' ? 'Devolver Pago' : 'Registrar Pago')}
                                        {task.data?.stage === 'origin' && (task.data?.is_invoice ? 'Confirmar Nota' : 'Confirmar Orden')}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Due Date */}
                {showDueDate && (
                    <span className="text-[11px] font-medium tracking-tight text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatShortDate(task.due_date)}
                    </span>
                )}

                {/* Credit Actions */}
                {task.task_type === 'CREDIT_POS_REQUEST' && task.status !== 'REJECTED' && (
                    <div className="pt-2 border-t border-border flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <button
                                className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2 hover:text-primary transition-colors group/name"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (task.data?.customer_id) openEntity('contacts.contact', task.data.customer_id);
                                }}
                            >
                                <User className="h-3 w-3" />
                                <span className="underline decoration-transparent group-hover/name:decoration-primary underline-offset-2">{task.data?.customer_name || 'Cliente'}</span>
                                <ExternalLink className="h-3 w-3 opacity-70 group-hover/name:opacity-100" />
                            </button>
                        </div>
                        <div className="text-[11px] text-muted-foreground mb-3 space-y-1.5 bg-muted/30 p-2.5 rounded-md border border-border/30">
                            {!task.data?.is_default_customer && task.data?.customer_name !== 'Publico General' && (
                                <div className="flex justify-between items-center text-destructive/90">
                                    <span className="opacity-70">Deuda Pendiente:</span>
                                    <MoneyDisplay amount={task.data?.customer_debt || 0} />
                                </div>
                            )}
                            <div className="flex justify-between items-center">
                                <span className="opacity-70">Línea de Crédito:</span>
                                <MoneyDisplay amount={task.data?.explicit_credit || task.data?.credit_available || 0} className="text-success" />
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="opacity-70">Crédito Pre-aprobado:</span>
                                <MoneyDisplay amount={task.data?.pos_credit || 0} className="text-info" />
                            </div>
                            <div className="flex justify-between items-center pt-1 mt-1 border-t border-border/30">
                                <span className="font-bold text-warning">Crédito pendiente de aprobación:</span>
                                <MoneyDisplay amount={task.data?.required_credit || 0} className="text-warning underline decoration-warning/30 underline-offset-2" />
                            </div>
                        </div>

                        {(user?.is_superuser || task.assigned_to === user?.id || !task.assigned_to) && (
                            <div className="flex justify-between gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-xs h-7 border-destructive/50 text-destructive hover:bg-destructive/10"
                                    onClick={(e) => handleCreditAction(e, task, 'REJECT')}
                                    disabled={actioningTask === task.id}
                                >
                                    Rechazar
                                </Button>
                                <Button
                                    size="sm"
                                    className="flex-1 text-xs h-7 bg-success/90 hover:bg-success text-success-foreground font-bold"
                                    onClick={(e) => handleCreditAction(e, task, 'APPROVE')}
                                    disabled={actioningTask === task.id}
                                >
                                    Aprobar
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        )
    }

    const tabItems: TabItem[] = [
        { value: 'approvals', label: 'Aprobaciones', icon: CheckCircle2, badge: approvalsPending.length },
        { value: 'tasks', label: 'Tareas', icon: ListTodo, badge: operationalTasks.length },
    ]

    return (
        <div className="h-full overflow-auto">
            <TabBar
                items={tabItems}
                value={activeTab}
                onValueChange={setActiveTab}
                orientation="horizontal"
                dense
                className="w-full px-4"
                contentClassName="mt-3 bg-transparent px-4"
            >
                <TabBarContent value="approvals">
                     {loading ? (
                         <div className="flex flex-col gap-2">
                             <TaskSkeleton />
                             <TaskSkeleton />
                             <TaskSkeleton />
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
                                <div className="flex flex-col items-center justify-center h-full text-center bg-muted/30 rounded-md border border-dashed text-muted-foreground">
                                    <CheckCircle2 className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-xs">No tienes aprobaciones</p>
                                </div>
                            )}
                        </>
                    )}
                 </TabBarContent>

                 <TabBarContent value="tasks">
                     {loading ? (
                         <div className="flex flex-col gap-2">
                             <TaskSkeleton />
                             <TaskSkeleton />
                             <TaskSkeleton />
                         </div>
                     ) : operationalTasks.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-center bg-muted/10 rounded-md border border-dashed text-muted-foreground">
                             <ListTodo className="h-8 w-8 mb-2 opacity-20" />
                             <p className="text-xs">No tienes tareas pendientes</p>
                         </div>
                     ) : (
                         <div className="space-y-3">
                             {groupedOperational.map(([group, tasks]) => (
                                 <CollapsibleSection
                                     key={group}
                                     title={GROUP_LABELS[group]}
                                     count={tasks.length}
                                     expanded={groupExpanded[group]}
                                     onToggle={() => setGroupExpanded(prev => ({ ...prev, [group]: !prev[group] }))}
                                 >
                                     {tasks.map(task => renderTaskCard(task))}
                                 </CollapsibleSection>
                             ))}
                         </div>
                     )}
                 </TabBarContent>
             </TabBar>
         </div>
    )
}
