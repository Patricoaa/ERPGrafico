"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { type Task } from '@/features/workflow/api/workflowApi'
import {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    type Notification,
} from "@/features/workflow"
import { useNotifications, type NotificationPayload } from "@/features/notifications"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Blobatar } from "@/components/ui/blobatar"
import { TabBar, TabBarContent, type TabItem, SkeletonShell, EmptyState } from "@/components/shared"
import {
    CheckCircle2, ListTodo, ChevronDown, ChevronRight, Package, FileText,
    Wallet, TrendingUp, CreditCard, Wrench, ShoppingCart, Receipt,
    CalendarX2, ClipboardList, ExternalLink, Bell, BellOff, Search, User,
    AtSign, MessageSquareReply, type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useOnEntityStackClose } from "@/hooks/useOnEntityStackClose"
import { documentForTask } from "../utils/taskDocument"
import { getTaskAssigneeStack } from "../utils/taskAssignees"
import { cn } from "@/lib/utils"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { formatMoney } from "@/lib/money"
import { useCompleteTask, useRejectTask } from "../hooks/useWorkflowMutations"
import { useTasks } from "../hooks/useTasks"
import { getEntityConfig } from "@/lib/api/entity-prefixes"

const HUB_STAGE_LABELS: Record<string, string> = {
    origin: 'Origen',
    logistics: 'Logística',
    billing: 'Facturación',
    treasury: 'Tesorería',
}

// Human-readable action labels per task type
const TASK_TYPE_LABELS: Record<string, string> = {
    CREDIT_POS_REQUEST: 'Solicitud de Crédito',
    OT_MATERIAL_APPROVAL: 'Aprobación de Materiales',
    OT_PREPRESS_APPROVAL: 'Aprobación de Pre-impresión',
    OT_PRESS_APPROVAL: 'Aprobación de Impresión',
    OT_POSTPRESS_APPROVAL: 'Aprobación de Post-impresión',
    OT_OUTSOURCING_VERIFICATION_APPROVAL: 'Verificación de Tercerización',
    OT_RECTIFICATION_APPROVAL: 'Rectificación y Cierre',
    OT_CREATION: 'Asignación de Materiales',
    F29_CREATE: 'F-29 — Crear declaración',
    F29_PAY: 'F-29 — Registrar pago',
    PERIOD_CLOSE: 'Cierre de Período',
}

// Rectification requires entering actual production quantities inside the OT wizard
const REQUIRES_DOC_OPEN = new Set(['OT_RECTIFICATION_APPROVAL'])

function requiresDocumentOpen(task: Task): boolean {
    return REQUIRES_DOC_OPEN.has(task.task_type)
}

function hasApprovedInCurrentCycle(task: Task, userId: number | undefined): boolean {
    if (!userId || !task.events_data) return false
    const latestReopenId = task.events_data
        .filter(e => e.action === 'REOPENED')
        .reduce((max, e) => Math.max(max, e.id), 0)
    return task.events_data.some(
        e => e.action === 'COMPLETED' && e.user === userId && e.id > latestReopenId,
    )
}

function approvalsInCurrentCycle(task: Task): number {
    if (!task.events_data) return 0
    const latestReopenId = task.events_data
        .filter(e => e.action === 'REOPENED')
        .reduce((max, e) => Math.max(max, e.id), 0)
    return task.events_data.filter(e => e.action === 'COMPLETED' && e.id > latestReopenId).length
}

function relativeTime(dateStr: string): string {
    try {
        return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es })
    } catch {
        return ''
    }
}

// ── Card data helpers ──────────────────────────────────────────────────────────

function getCardTitle(task: Task): string {
    if (TASK_TYPE_LABELS[task.task_type]) return TASK_TYPE_LABELS[task.task_type]
    if (task.task_type.startsWith('HUB_')) {
        const stage = String(task.data?.stage ?? '')
        return HUB_STAGE_LABELS[stage] ? `Revisión — ${HUB_STAGE_LABELS[stage]}` : task.title
    }
    // Strip any doc-number pattern from the title (e.g. " - OT #12", "OCS #3 - ")
    return task.title
        .replace(/\s*[-–]\s*(OT|OCS|OV|NC|ND)\s*#\d+/gi, '')
        .replace(/(OT|OCS|OV|NC|ND)\s*#\d+\s*[-–]?\s*/gi, '')
        .trim() || task.title
}

function getCardRef(task: Task): string | null {
    const data = task.data ?? {}

    // OT tasks: use the explicit work_order_number field added at task creation.
    // Fallback: parse "OT-000012" pattern from the title (legacy tasks without data).
    if (task.task_type.startsWith('OT_')) {
        const prefix = getEntityConfig("production.workorder")?.prefix ?? "OT"
        const num = data.work_order_number
        if (num) return `${prefix} #${Number(num)}`
        const match = /OT-0*(\d+)/i.exec(task.title)
        if (match) return `${prefix} #${match[1]}`
        return null
    }

    const num = data.order_number
    if (!num) return null

    if (task.task_type.startsWith('OC_')) {
        const prefix = getEntityConfig("purchasing.purchaseorder")?.prefix ?? "OCS"
        return `${prefix} #${num}`
    }
    if (task.task_type.startsWith('OV_') || task.task_type.startsWith('NC_') || task.task_type.startsWith('ND_')) {
        const prefix = getEntityConfig("sales.saleorder")?.prefix ?? "OV"
        return `${prefix} #${num}`
    }
    if (task.task_type.startsWith('HUB_')) {
        const entityLabel = data.order_type === 'purchase' ? 'purchasing.purchaseorder' : 'sales.saleorder'
        const prefix = getEntityConfig(entityLabel)?.prefix ?? (data.order_type === 'purchase' ? 'OCS' : 'OV')
        return `${prefix} #${num}`
    }
    return null
}

function getPrimaryAmount(task: Task): string | null {
    const data = task.data ?? {}
    if (data.required_credit) return formatMoney(Number(data.required_credit))
    if (data.order_total) return formatMoney(Number(data.order_total))
    return null
}

function getContextItems(task: Task): Array<{ label: string; value: string }> {
    const items: Array<{ label: string; value: string }> = []
    const data = task.data ?? {}
    if (data.customer_name) items.push({ label: 'Cliente', value: String(data.customer_name) })
    else if (data.contact_name) items.push({ label: 'Contacto', value: String(data.contact_name) })
    if (data.required_credit && data.credit_available !== undefined && data.credit_available !== null) {
        items.push({ label: 'Disponible', value: formatMoney(Number(data.credit_available)) })
    }
    return items
}

function getTaskIcon(task: Task) {
    if (task.task_type.startsWith('HUB_')) {
        if (task.data?.stage === 'origin') return TrendingUp
        if (task.data?.stage === 'logistics') return Package
        if (task.data?.stage === 'billing') return FileText
        if (task.data?.stage === 'treasury') return Wallet
    }
    if (task.task_type === 'CREDIT_POS_REQUEST') return CreditCard
    if (task.task_type.startsWith('OT_')) return Wrench
    if (task.task_type.startsWith('OC_')) return ShoppingCart
    if (task.task_type.startsWith('OV_') || task.task_type.startsWith('NC_') || task.task_type.startsWith('ND_')) return FileText
    if (task.task_type === 'F29_CREATE' || task.task_type === 'F29_PAY') return Receipt
    if (task.task_type === 'PERIOD_CLOSE') return CalendarX2
    return ClipboardList
}

function canActOnTask(task: Task, user: { id?: number; is_superuser?: boolean; groups?: Array<{ id: number }> } | null): boolean {
    if (!user) return false
    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') return false
    return (
        !!user.is_superuser ||
        task.assigned_to === user.id ||
        (task.assigned_group != null && (user.groups?.some(g => g.id === task.assigned_group) ?? false))
    )
}

function taskMatchesSearch(task: Task, q: string): boolean {
    if (!q) return true
    const low = q.toLowerCase()
    return [
        task.title, task.data?.customer_name, task.data?.contact_name,
        task.data?.order_number, getCardTitle(task), getCardRef(task),
    ].some(f => f && String(f).toLowerCase().includes(low))
}

function notificationMatchesSearch(n: Notification, q: string): boolean {
    if (!q) return true
    const low = q.toLowerCase()
    return [n.title, n.message].some(f => f && f.toLowerCase().includes(low))
}

// ── Section divider ────────────────────────────────────────────────────────────

interface SectionGroupProps {
    title: string
    count: number
    hint?: string
    expanded: boolean
    onToggle: () => void
    children: React.ReactNode
    alwaysOpen?: boolean
    action?: React.ReactNode
}

function SectionGroup({ title, count, hint, expanded, onToggle, children, alwaysOpen, action }: SectionGroupProps) {
    if (alwaysOpen) {
        return (
            <div className="mb-3">
                <div className="flex items-center gap-2 px-4 py-1.5 mb-1">
                    <span className="text-3xs font-medium text-muted-foreground/55 uppercase tracking-wider">{title}</span>
                    {count > 0 && <span className="text-3xs text-muted-foreground/35 tabular-nums">({count})</span>}
                    <div className="flex-1 h-px bg-border/40" />
                    {hint && <span className="text-3xs text-muted-foreground/35 shrink-0">{hint}</span>}
                    {action}
                </div>
                <div className="space-y-1 px-3">{children}</div>
            </div>
        )
    }

    return (
        <div className="mb-2">
            <Button
                variant="ghost"
                onClick={onToggle}
                className="flex items-center justify-between w-full h-auto px-4 py-1.5 text-3xs font-medium text-muted-foreground/55 uppercase tracking-wider hover:text-muted-foreground hover:bg-transparent transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span>{title}</span>
                    {count > 0 && <span className="tabular-nums text-muted-foreground/35">({count})</span>}
                    <div className="w-10 h-px bg-border/40" />
                </div>
                <div className="flex items-center gap-1.5">
                    {action}
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                </div>
            </Button>
            {expanded && (
                <div className="mt-1 space-y-1 px-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    {children}
                </div>
            )}
        </div>
    )
}

// ── Shared CTA bar ─────────────────────────────────────────────────────────────

/** Ícono por tipo de aviso: los de comentarios (ADR-0111) se distinguen del resto. */
const NOTIFICATION_ICONS: Record<string, LucideIcon> = {
    comment_mention: AtSign,
    comment_reply: MessageSquareReply,
}

function isNavigableNotification(n: Notification): boolean {
    return !!n.link || (typeof n.data?.label === 'string' && typeof n.data?.id === 'number')
}

function CtaBar({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border/20 bg-muted/15">
            {children}
        </div>
    )
}

// ── Main inbox ─────────────────────────────────────────────────────────────────

interface TaskInboxProps {
    onCountChange?: (counts: { total: number; approvals: number; tasks: number; notifications: number }) => void
}

export function TaskInbox({ onCountChange }: TaskInboxProps) {
    const { approvalTasks, operationalTasks, isLoading, refetch } = useTasks()
    const [actioningTask, setActioningTask] = useState<number | null>(null)
    const [activeTab, setActiveTab] = useState("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [approvalsExpanded, setApprovalsExpanded] = useState(true)
    const [inProgressExpanded, setInProgressExpanded] = useState(true)
    const [completedExpanded, setCompletedExpanded] = useState(false)
    const [rejectedExpanded, setRejectedExpanded] = useState(false)
    const [cancelledExpanded, setCancelledExpanded] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const { openEntity } = useGlobalModalActions()
    useOnEntityStackClose(() => { void refetch() })
    const { user } = useAuth()
    const searchParams = useSearchParams()
    const router = useRouter()
    const selectedId = searchParams.get('selected')

    const approvalsPending = approvalTasks.filter(t => t.status === 'PENDING')
    const approvalsInProgress = approvalTasks.filter(t => t.status === 'IN_PROGRESS')
    const approvalsCompleted = approvalTasks.filter(t => t.status === 'COMPLETED')
    const approvalsRejected = approvalTasks.filter(t => t.status === 'REJECTED')
    const approvalsCancelled = approvalTasks.filter(t => t.status === 'CANCELLED')
    const approvalsActiveCount = approvalsPending.length + approvalsInProgress.length

    // ── Notifications ────────────────────────────────────────────────────────────

    const fetchNotifications = useCallback(async () => {
        try {
            const [data, count] = await Promise.all([getNotifications(), getUnreadNotificationCount()])
            setNotifications(data)
            setUnreadCount(count)
        } catch { /* silently skip */ }
    }, [])

    useNotifications((payload: NotificationPayload) => {
        setNotifications(prev => [payload as Notification, ...prev].slice(0, 20))
        setUnreadCount(prev => prev + 1)
    })

    useEffect(() => {
        if (!user) return
        let cancelled = false
        ;(async () => { await fetchNotifications() })()
        const interval = setInterval(() => { if (!cancelled) void fetchNotifications() }, 120000)
        return () => { cancelled = true; clearInterval(interval) }
    }, [user, fetchNotifications])

    const handleNotificationClick = useCallback(async (n: Notification) => {
        if (!n.read) {
            try {
                await markNotificationRead(n.id)
                setUnreadCount(prev => Math.max(0, prev - 1))
                setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
            } catch { /* ignore */ }
        }
        // Notificaciones con entidad (comentarios, ADR-0111) se abren en su drawer.
        const label = n.data?.label
        const id = n.data?.id
        if (typeof label === 'string' && typeof id === 'number') { openEntity(label, id); return }
        if (n.link) router.push(n.link)
    }, [router, openEntity])

    const handleMarkAllRead = useCallback(async () => {
        try {
            await markAllNotificationsRead()
            setUnreadCount(0)
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            toast.success("Notificaciones marcadas como leídas")
        } catch { /* ignore */ }
    }, [])

    // ── Counts ───────────────────────────────────────────────────────────────────

    useEffect(() => {
        onCountChange?.({
            total: approvalsActiveCount + operationalTasks.length,
            approvals: approvalsActiveCount,
            tasks: operationalTasks.length,
            notifications: unreadCount,
        })
    }, [approvalsActiveCount, operationalTasks.length, unreadCount, onCountChange])

    // ── Navigation ────────────────────────────────────────────────────────────────

    const navigateToTask = useCallback((task: Task) => {
        // Credit POS: open customer sheet as entity drawer
        if (task.task_type === 'CREDIT_POS_REQUEST') {
            const customerId = task.data?.customer_id
            if (customerId) openEntity('contacts.contact', Number(customerId))
            return
        }
        const target = documentForTask(task)
        if (target) { openEntity(target.label, target.id); return }
        if (task.task_type === 'F29_CREATE' || task.task_type === 'F29_PAY') {
            const year = task.data?.year ?? ''; const month = task.data?.month ?? ''
            window.location.href = `/accounting?view=tax&year=${year}&month=${month}&action=${task.task_type === 'F29_PAY' ? 'pay' : 'create'}`
            return
        }
        if (task.task_type === 'PERIOD_CLOSE') {
            window.location.href = `/accounting/periods?year=${task.data?.year ?? ''}&month=${task.data?.month ?? ''}`
            return
        }
        toast.info("Navegación específica no configurada para este tipo de tarea")
    }, [openEntity])

    useEffect(() => {
        if (selectedId && !isLoading) {
            const task = [...approvalTasks, ...operationalTasks].find(t => t.id === parseInt(selectedId))
            if (task) {
                navigateToTask(task)
                const params = new URLSearchParams(searchParams.toString())
                params.delete('selected')
                router.replace(`?${params.toString()}`, { scroll: false })
            }
        }
    }, [selectedId, isLoading, approvalTasks, operationalTasks, navigateToTask, searchParams, router])

    const { completeTask } = useCompleteTask()
    const { rejectTask } = useRejectTask()

    const handleApprovalAction = async (e: React.MouseEvent, task: Task, action: 'APPROVE' | 'REJECT') => {
        e.stopPropagation()
        try {
            setActioningTask(task.id)
            const notes = action === 'APPROVE' ? 'Aprobado desde Bandeja' : 'Rechazado desde Bandeja'
            if (action === 'APPROVE') await completeTask({ id: task.id, notes })
            else await rejectTask({ id: task.id, notes })
            void refetch()
        } catch {
            // Mutation hooks display the error toast.
        } finally {
            setActioningTask(null)
        }
    }

    // ── Filtered lists ────────────────────────────────────────────────────────────

    const filteredApprovalTasks = useMemo(() => approvalTasks.filter(t => {
        if (!taskMatchesSearch(t, searchQuery)) return false
        return t.status === 'PENDING' || t.status === 'IN_PROGRESS'
    }), [approvalTasks, searchQuery])

    const filteredOperationalTasks = useMemo(() =>
        operationalTasks.filter(t => taskMatchesSearch(t, searchQuery)),
    [operationalTasks, searchQuery])

    const filteredNotifications = useMemo(() =>
        notifications.filter(n => notificationMatchesSearch(n, searchQuery)),
    [notifications, searchQuery])

    const taskAssigneeStack = useMemo(
        () => getTaskAssigneeStack(operationalTasks),
        [operationalTasks],
    )

    // ── Approval card ────────────────────────────────────────────────────────────

    const renderApprovalCard = (task: Task) => {
        const isActive = task.status === 'PENDING' || task.status === 'IN_PROGRESS'
        const isCompleted = task.status === 'COMPLETED'
        const userCanAct = canActOnTask(task, user)
        const alreadyApproved = hasApprovedInCurrentCycle(task, user?.id)
        const forceOpenDoc = requiresDocumentOpen(task)
        const showInline = isActive && userCanAct && !alreadyApproved && !forceOpenDoc
        const contextItems = getContextItems(task)
        const cardTitle = getCardTitle(task)
        const cardRef = getCardRef(task)
        const primaryAmount = getPrimaryAmount(task)
        const Icon = getTaskIcon(task)
        const hasDocument = !!documentForTask(task)
        const canOpenCustomer = task.task_type === 'CREDIT_POS_REQUEST' && !!task.data?.customer_id
        const assigneeName = task.assigned_group_name ?? task.assigned_to_data?.username ?? null
        const createdAt = task.created_at ? relativeTime(task.created_at) : null

        const iconColor = isActive ? "text-warning" : isCompleted ? "text-success" : "text-muted-foreground/40"

        return (
            <div
                key={task.id}
                className={cn(
                    "surface-item flex flex-col rounded-sm select-none overflow-hidden",
                    !isActive && "opacity-50",
                )}
            >
                <div className="flex items-start gap-2 p-3 pb-2">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", iconColor)} aria-hidden />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1.5">
                            <p className="text-xs font-semibold tracking-tight text-foreground leading-snug">
                                {cardTitle}
                            </p>
                            {primaryAmount && (
                                <span className="text-xs font-bold tabular-nums shrink-0 text-foreground/80 leading-snug">
                                    {primaryAmount}
                                </span>
                            )}
                        </div>

                        {cardRef && (
                            <span className="inline-block mt-0.5 text-3xs text-muted-foreground/55 font-mono bg-muted/50 px-1.5 py-px rounded-sm leading-none">
                                {cardRef}
                            </span>
                        )}

                        {(assigneeName || createdAt) && (
                            <p className="flex items-center gap-1 text-2xs text-muted-foreground/45 mt-1">
                                {assigneeName && <><User className="h-2.5 w-2.5 shrink-0" aria-hidden /><span>{assigneeName}</span></>}
                                {assigneeName && createdAt && <span aria-hidden>·</span>}
                                {createdAt && <span>{createdAt}</span>}
                            </p>
                        )}

                        {contextItems.length > 0 && (
                            <dl className="flex flex-wrap gap-x-3 gap-y-0 mt-1.5">
                                {contextItems.map(({ label, value }) => (
                                    <div key={label} className="flex items-baseline gap-1">
                                        <dt className="text-2xs text-muted-foreground/40 font-medium">{label}:</dt>
                                        <dd className="text-2xs text-foreground/65 tabular-nums">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}

                        {approvalsInCurrentCycle(task) > 0 && isActive && (
                            <p className="text-2xs text-muted-foreground/55 mt-1">
                                {alreadyApproved
                                    ? 'Tu aprobación fue registrada; falta otra.'
                                    : `${approvalsInCurrentCycle(task)} aprobación(es) registrada(s).`}
                            </p>
                        )}
                    </div>
                </div>

                {(showInline || forceOpenDoc || hasDocument || canOpenCustomer) && (
                    <CtaBar>
                        {showInline && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-3xs h-7 px-2 border-destructive/30 text-destructive hover:bg-destructive/10 rounded-sm font-semibold uppercase tracking-wide"
                                    onClick={(e) => handleApprovalAction(e, task, 'REJECT')}
                                    disabled={actioningTask === task.id}
                                >
                                    Rechazar
                                </Button>
                                <Button
                                    size="sm"
                                    className="flex-1 text-3xs h-7 px-2 bg-success/90 hover:bg-success text-success-foreground font-semibold rounded-sm uppercase tracking-wide"
                                    onClick={(e) => handleApprovalAction(e, task, 'APPROVE')}
                                    disabled={actioningTask === task.id}
                                >
                                    Aprobar
                                </Button>
                            </>
                        )}
                        {forceOpenDoc && isActive && (
                            <p className="text-2xs text-muted-foreground/55 flex-1 italic">
                                Abre la OT para completar la rectificación.
                            </p>
                        )}
                        {(hasDocument || canOpenCustomer) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-2 text-2xs text-muted-foreground/50 hover:text-foreground gap-1 shrink-0 font-medium ml-auto"
                                onClick={() => navigateToTask(task)}
                                aria-label={canOpenCustomer ? "Ver ficha de cliente" : "Ver documento"}
                            >
                                <ExternalLink className="h-3 w-3" />
                                {canOpenCustomer ? 'Ver cliente' : 'Ver doc.'}
                            </Button>
                        )}
                    </CtaBar>
                )}
            </div>
        )
    }

    // ── Task card ─────────────────────────────────────────────────────────────────

    const renderOperationalCard = (task: Task) => {
        const Icon = getTaskIcon(task)
        const cardRef = getCardRef(task)
        const createdAt = task.created_at ? relativeTime(task.created_at) : null
        return (
            <Button
                key={task.id}
                type="button"
                variant="ghost"
                onClick={() => navigateToTask(task)}
                aria-label={`Abrir tarea: ${getCardTitle(task)}`}
                className="surface-item group h-auto min-h-0 w-full flex flex-col items-stretch justify-start overflow-hidden rounded-sm p-0 text-left transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                <div className="flex items-start gap-2 p-3">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground leading-snug">{getCardTitle(task)}</p>
                            <span className="flex shrink-0 items-center gap-1 text-2xs font-medium text-muted-foreground/55 transition-colors group-hover:text-foreground">
                                <ExternalLink className="h-3 w-3" aria-hidden />
                                Abrir
                            </span>
                        </div>
                        {cardRef && (
                            <span className="inline-block mt-0.5 text-3xs text-muted-foreground/55 font-mono bg-muted/50 px-1.5 py-px rounded-sm leading-none">
                                {cardRef}
                            </span>
                        )}
                        {createdAt && (
                            <p className="flex items-center gap-1 text-2xs text-muted-foreground/45 mt-1">
                                {createdAt && <span>{createdAt}</span>}
                            </p>
                        )}
                    </div>
                </div>
            </Button>
        )
    }

    // ── Notification card ─────────────────────────────────────────────────────────

    const renderNotificationCard = (n: Notification) => {
        const Icon = NOTIFICATION_ICONS[n.notification_type ?? ''] ?? Bell
        const navigable = isNavigableNotification(n)
        return (
            <Button
                key={n.id}
                type="button"
                variant="ghost"
                onClick={() => handleNotificationClick(n)}
                aria-label={`${navigable ? 'Abrir' : 'Marcar como leído'}: ${n.title}`}
                className={cn(
                    "surface-item group h-auto min-h-0 w-full flex items-start justify-start gap-2 overflow-hidden rounded-sm p-3 text-left transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    !n.read && "bg-primary/[0.03]",
                )}
            >
                <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", n.read ? "text-muted-foreground/40" : "text-primary")} aria-hidden />
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                        <p className={cn("truncate text-xs leading-snug", n.read ? "font-medium text-foreground/60" : "font-semibold text-foreground")}>
                            {n.title}
                        </p>
                        <span className="shrink-0 text-3xs text-muted-foreground/40">{relativeTime(n.created_at)}</span>
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 self-center rounded-full bg-primary" aria-label="No leído" />}
                    </div>
                    {n.message && (
                        <p className="mt-0.5 line-clamp-2 whitespace-normal text-2xs text-muted-foreground/60">{n.message}</p>
                    )}
                </div>
                {navigable && (
                    <ExternalLink
                        className="h-3 w-3 shrink-0 self-center text-muted-foreground/45 transition-colors group-hover:text-foreground"
                        aria-hidden
                    />
                )}
            </Button>
        )
    }

    // ── Search + filter bar ───────────────────────────────────────────────────────

    const renderSearchBar = () => (
        <div className="flex items-center px-3 py-1.5 border-b border-border/30 shrink-0">
            <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/45 pointer-events-none" />
                <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar…"
                    className="h-6 pl-6 text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
            </div>
        </div>
    )

    // ── Filtered groups for Todo tab ──────────────────────────────────────────────

    const allPending  = filteredApprovalTasks.filter(t => t.status === 'PENDING')
    const allProgress = filteredApprovalTasks.filter(t => t.status === 'IN_PROGRESS')

    const tabItems: TabItem[] = [
        { value: 'all',      label: 'Todo' },
        { value: 'approvals', label: 'Aprob.',  badge: approvalsActiveCount || undefined },
        { value: 'tasks',     label: 'Tareas',  badge: operationalTasks.length || undefined },
        { value: 'notices',   label: 'Avisos',  badge: unreadCount || undefined },
    ]

    return (
        <div className="flex flex-col h-full min-h-0">
            <TabBar
                items={tabItems}
                value={activeTab}
                onValueChange={setActiveTab}
                orientation="horizontal"
                variant="underline"
                dense
                stretchTabs
                className="w-full"
                contentClassName="flex-1 min-h-0 bg-transparent flex flex-col overflow-hidden"
            >
                {/* ── Todo tab ──────────────────────────────────────────────── */}
                <TabBarContent value="all" className="flex flex-col h-full mt-0 min-h-0">
                    {renderSearchBar()}
                    <SkeletonShell isLoading={isLoading} ariaLabel="Cargando bandeja">
                        <div className="flex-1 overflow-y-auto py-3">
                            {allPending.length > 0 && (
                                <SectionGroup title="Aprobaciones pendientes" count={allPending.length} hint="Prioridad" expanded={approvalsExpanded} onToggle={() => setApprovalsExpanded(v => !v)} alwaysOpen>
                                    {allPending.map(renderApprovalCard)}
                                </SectionGroup>
                            )}
                            {allProgress.length > 0 && (
                                <SectionGroup title="Aprobaciones en curso" count={allProgress.length} expanded={inProgressExpanded} onToggle={() => setInProgressExpanded(v => !v)} alwaysOpen>
                                    {allProgress.map(renderApprovalCard)}
                                </SectionGroup>
                            )}
                            {filteredOperationalTasks.length > 0 && (
                                <SectionGroup title="Tareas" count={filteredOperationalTasks.length} hint="Asignadas a ti" expanded={true} onToggle={() => {}} alwaysOpen>
                                    {filteredOperationalTasks.map(renderOperationalCard)}
                                </SectionGroup>
                            )}
                            {filteredNotifications.length > 0 && (
                                <SectionGroup
                                    title="Avisos"
                                    count={filteredNotifications.length}
                                    expanded={true}
                                    onToggle={() => {}}
                                    alwaysOpen
                                    action={unreadCount > 0 ? (
                                        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-3xs text-muted-foreground/45 hover:text-foreground hover:bg-transparent font-medium" onClick={handleMarkAllRead}>
                                            Leer todo
                                        </Button>
                                    ) : undefined}
                                >
                                    {filteredNotifications.slice(0, 5).map(renderNotificationCard)}
                                </SectionGroup>
                            )}
                            {filteredApprovalTasks.length === 0 && filteredOperationalTasks.length === 0 && filteredNotifications.length === 0 && (
                                <EmptyState
                                    variant="compact"
                                    icon={CheckCircle2}
                                    title={searchQuery ? "Sin resultados" : "Bandeja al día"}
                                    className="mx-3 bg-muted/10 rounded-md border border-dashed"
                                />
                            )}
                        </div>
                    </SkeletonShell>
                </TabBarContent>

                {/* ── Approvals tab ──────────────────────────────────────────── */}
                <TabBarContent value="approvals" className="flex flex-col h-full mt-0 min-h-0">
                    <SkeletonShell isLoading={isLoading} ariaLabel="Cargando aprobaciones">
                        <div className="flex-1 overflow-y-auto py-3">
                            {approvalsPending.length > 0 && (
                                <SectionGroup title="Pendientes" count={approvalsPending.length} hint="Prioridad para ti" expanded={approvalsExpanded} onToggle={() => setApprovalsExpanded(v => !v)} alwaysOpen>
                                    {approvalsPending.map(renderApprovalCard)}
                                </SectionGroup>
                            )}
                            {approvalsInProgress.length > 0 && (
                                <SectionGroup title="En curso" count={approvalsInProgress.length} expanded={inProgressExpanded} onToggle={() => setInProgressExpanded(v => !v)} alwaysOpen>
                                    {approvalsInProgress.map(renderApprovalCard)}
                                </SectionGroup>
                            )}
                            {approvalsCompleted.length > 0 && (
                                <SectionGroup title="Completadas" count={approvalsCompleted.length} expanded={completedExpanded} onToggle={() => setCompletedExpanded(v => !v)}>
                                    {approvalsCompleted.slice(0, 10).map(renderApprovalCard)}
                                </SectionGroup>
                            )}
                            {approvalsRejected.length > 0 && (
                                <SectionGroup title="Rechazadas" count={approvalsRejected.length} expanded={rejectedExpanded} onToggle={() => setRejectedExpanded(v => !v)}>
                                    {approvalsRejected.slice(0, 10).map(renderApprovalCard)}
                                </SectionGroup>
                            )}
                            {approvalsCancelled.length > 0 && (
                                <SectionGroup title="Canceladas" count={approvalsCancelled.length} expanded={cancelledExpanded} onToggle={() => setCancelledExpanded(v => !v)}>
                                    {approvalsCancelled.slice(0, 10).map(renderApprovalCard)}
                                </SectionGroup>
                            )}
                            {approvalTasks.length === 0 && (
                                <EmptyState variant="compact" icon={CheckCircle2} title="No tienes aprobaciones" className="mx-3 bg-muted/20 rounded-md border border-dashed" />
                            )}
                        </div>
                    </SkeletonShell>
                </TabBarContent>

                {/* ── Tasks tab ─────────────────────────────────────────────── */}
                <TabBarContent value="tasks" className="flex flex-col h-full mt-0 min-h-0">
                    <SkeletonShell isLoading={isLoading} ariaLabel="Cargando tareas" className="flex-1 min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0 overflow-y-auto py-3">
                            {operationalTasks.length === 0 ? (
                                <EmptyState variant="compact" icon={ListTodo} title="No tienes tareas pendientes" className="mx-3 bg-muted/10 rounded-md border border-dashed" />
                            ) : (
                                <SectionGroup title="Asignadas a ti" count={operationalTasks.length} expanded={true} onToggle={() => {}} alwaysOpen>
                                    {operationalTasks.map(renderOperationalCard)}
                                </SectionGroup>
                            )}
                        </div>
                    </SkeletonShell>
                    {taskAssigneeStack.users.length > 0 && (
                        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/30 bg-muted/10 px-4 py-2.5" aria-label="Usuarios asignados a las tareas">
                            <span className="text-2xs font-medium text-muted-foreground">Asignados ({taskAssigneeStack.totalCount})</span>
                            <div className="flex items-center -space-x-2" aria-label="Usuarios asignados">
                                {taskAssigneeStack.users.map((assignee) => {
                                    const name = [assignee.first_name, assignee.last_name].filter(Boolean).join(" ") || assignee.username
                                    return (
                                        <Blobatar
                                            key={assignee.id}
                                            name={name}
                                            blobatar={{ title: name }}
                                            className="size-7 border-2 border-background"
                                        />
                                    )
                                })}
                                {taskAssigneeStack.overflowCount > 0 && (
                                    <span
                                        className="relative z-10 inline-flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-2xs font-medium text-muted-foreground"
                                        aria-label={`${taskAssigneeStack.overflowCount} usuarios más`}
                                    >
                                        +{taskAssigneeStack.overflowCount}
                                    </span>
                                )}
                            </div>
                        </footer>
                    )}
                </TabBarContent>

                {/* ── Notices tab ───────────────────────────────────────────── */}
                <TabBarContent value="notices" className="flex flex-col h-full mt-0 min-h-0">
                    <div className="flex-1 overflow-y-auto py-3">
                        {notifications.length === 0 ? (
                            <EmptyState variant="compact" icon={BellOff} title="Sin notificaciones" description="Aparecerán aquí cuando recibas avisos del sistema." className="mx-3 bg-muted/10 rounded-md border border-dashed" />
                        ) : (
                            <SectionGroup
                                title="Para tu información"
                                count={notifications.length}
                                expanded={true}
                                onToggle={() => {}}
                                alwaysOpen
                                action={unreadCount > 0 ? (
                                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-3xs text-muted-foreground/45 hover:text-foreground hover:bg-transparent font-medium" onClick={handleMarkAllRead}>
                                        <Bell className="h-2.5 w-2.5 mr-0.5" />
                                        Leer todo
                                    </Button>
                                ) : undefined}
                            >
                                {notifications.map(renderNotificationCard)}
                            </SectionGroup>
                        )}
                    </div>
                </TabBarContent>
            </TabBar>
        </div>
    )
}
