"use client"
import { useState, useEffect, useCallback } from "react"
import { getTasks, type Task } from '@/features/workflow/api/workflowApi'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TabBar, TabBarContent, type TabItem } from "@/components/shared"
import { CheckCircle2, ListTodo, ChevronDown, ChevronRight, Package, FileText, Wallet, TrendingUp, ArrowRight, CreditCard, Wrench, ShoppingCart, Receipt, CalendarX2, ClipboardList } from "lucide-react"
import { toast } from "sonner"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { cn } from "@/lib/utils"
import { useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { useUpdateTask } from "../hooks/useWorkflowMutations"

const HUB_STAGE_LABELS: Record<string, string> = {
    origin: 'Origen',
    logistics: 'Logística',
    billing: 'Facturación',
    treasury: 'Tesorería',
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

    const { updateTask } = useUpdateTask()

    const handleCreditAction = async (e: React.MouseEvent, task: Task, action: 'APPROVE' | 'REJECT') => {
        e.stopPropagation()
        try {
            setActioningTask(task.id)
            const status = action === 'APPROVE' ? 'COMPLETED' : 'REJECTED'
            const notes = action === 'APPROVE' ? 'Aprobado desde Inbox POS' : 'Rechazado desde Inbox POS'

            await updateTask({
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


    const getTaskIcon = (task: Task) => {
        if (task.task_type?.startsWith('HUB_')) {
            if (task.data?.stage === 'origin') return TrendingUp
            if (task.data?.stage === 'logistics') return Package
            if (task.data?.stage === 'billing') return FileText
            if (task.data?.stage === 'treasury') return Wallet
        }
        if (task.task_type === 'CREDIT_POS_REQUEST') return CreditCard
        if (task.task_type?.includes('OT_')) return Wrench
        if (task.task_type?.includes('OC_')) return ShoppingCart
        if (task.task_type?.includes('OV_') || task.task_type?.includes('NC_') || task.task_type?.includes('ND_')) return FileText
        if (task.task_type === 'F29_CREATE' || task.task_type === 'F29_PAY') return Receipt
        if (task.task_type === 'PERIOD_CLOSE') return CalendarX2
        return ClipboardList
    }

    const renderTaskCard = (task: Task) => {
        const isRejected = task.status === 'REJECTED'

        return (
            <Card
                key={task.id}
                className={cn(
                    "card-base px-3 py-2.5 cursor-pointer group flex flex-col gap-2 w-full",
                    "transition-all duration-150 ease-out hover:shadow-sm hover:bg-muted/40",
                    isRejected && "opacity-40 grayscale-[0.5]"
                )}
                onClick={() => navigateToTask(task)}
            >
                {/* Title + arrow */}
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-medium text-foreground line-clamp-2 flex-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {(() => { const Icon = getTaskIcon(task); return <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" /> })()}
                        {task.task_type === 'CREDIT_POS_REQUEST' ? (
                            `Aprobación Crédito: ${task.data?.customer_name || task.title.replace('Aprobación Crédito: ', '') || 'Cliente'}`
                        ) : task.task_type?.startsWith('HUB_') ? (
                            <span>{HUB_STAGE_LABELS[task.data?.stage as keyof typeof HUB_STAGE_LABELS] || task.data?.stage}:{' '}
                                {formatEntityDisplay(task.data?.order_type === 'purchase' ? 'purchasing.purchaseorder' : 'sales.saleorder', { number: task.data?.order_number })}
                            </span>
                        ) : (
                            task.title
                        )}
                    </h3>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-all duration-150 -translate-x-1 group-hover:translate-x-0 shrink-0" />
                </div>

                {/* Credit: approve/reject buttons only */}
                {task.task_type === 'CREDIT_POS_REQUEST' && task.status !== 'REJECTED' &&
                    (user?.is_superuser || task.assigned_to === user?.id || !task.assigned_to) && (
                    <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
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
            </Card>
        )
    }

    const tabItems: TabItem[] = [
        { value: 'approvals', label: 'Aprobaciones', icon: CheckCircle2, badge: approvalsPending.length },
        { value: 'tasks', label: 'Tareas', icon: ListTodo, badge: operationalTasks.length },
    ]

    return (
        <div className="flex flex-col h-full">
            <TabBar
                items={tabItems}
                value={activeTab}
                onValueChange={setActiveTab}
                orientation="horizontal"
                dense
                className="w-full px-4"
                contentClassName="mt-3 bg-transparent px-4 flex flex-col"
            >
                <TabBarContent value="approvals" className="h-full flex flex-col mt-0">
                     {loading ? (
                         <div className="flex flex-col gap-2">
                             <TaskSkeleton />
                             <TaskSkeleton />
                             <TaskSkeleton />
                         </div>
                     ) : (
                         <div className="flex flex-col flex-1">
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
                                 <div className="flex flex-1 flex-col items-center justify-center text-center bg-muted/30 rounded-md border border-dashed text-muted-foreground">
                                     <CheckCircle2 className="h-8 w-8 mb-2 opacity-20" />
                                     <p className="text-xs">No tienes aprobaciones</p>
                                 </div>
                             )}
                         </div>
                    )}
                 </TabBarContent>

                 <TabBarContent value="tasks" className="h-full flex flex-col mt-0">
                     {loading ? (
                         <div className="flex flex-col gap-2">
                             <TaskSkeleton />
                             <TaskSkeleton />
                             <TaskSkeleton />
                         </div>
                     ) : operationalTasks.length === 0 ? (
                         <div className="flex flex-1 flex-col items-center justify-center text-center bg-muted/10 rounded-md border border-dashed text-muted-foreground">
                             <ListTodo className="h-8 w-8 mb-2 opacity-20" />
                             <p className="text-xs">No tienes tareas pendientes</p>
                         </div>
                      ) : (
                          <div className="space-y-2">
                              {operationalTasks.map(task => renderTaskCard(task))}
                          </div>
                      )}
                 </TabBarContent>
             </TabBar>
         </div>
    )
}
