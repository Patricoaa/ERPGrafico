"use client"

import React, { useEffect, useCallback, useRef } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { UserSelector } from "@/components/selectors/UserSelector"
import { GroupSelector } from "@/components/selectors/GroupSelector"
import {
    Settings, AlertCircle, CheckCircle2, User, Users, Loader2,
    CalendarClock, BellRing, UserCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { CardSkeleton } from "@/components/shared"
import type { WorkflowRule, NotificationRule } from "@/types/entities"
import { useAutoSaveForm, type AutoSaveStatus } from "@/hooks/useAutoSaveForm"
import { useCombinedAutoSaveStatus } from "@/hooks/useCombinedAutoSaveStatus"
import {
    useWorkflowRulesQuery,
    useNotificationRulesQuery,
    useWorkflowRecurrentSettingsQuery,
    workflowKeys,
    type WorkflowRecurrentSettings,
} from "../hooks/useWorkflowQueries"

// ─── Static data ──────────────────────────────────────────────────────────────

const TASK_TYPES = [
    { id: "OT_MATERIAL_APPROVAL",             name: "Aprobación de Stock",         description: "Validación de existencia de materiales." },
    { id: "OT_PREPRESS_APPROVAL",              name: "Pre-Prensa (Diseño)",          description: "Validación de archivos de diseño." },
    { id: "OT_PRESS_APPROVAL",                 name: "Prensa (Impresión)",           description: "Validación de salida de prensa." },
    { id: "OT_POSTPRESS_APPROVAL",             name: "Post-Prensa (Terminado)",      description: "Validación de acabados finales." },
    { id: "OT_OUTSOURCING_VERIFICATION_APPROVAL", name: "Verificación Tercerizados", description: "Recepción de trabajos externos." },
    { id: "CREDIT_POS_REQUEST",               name: "Aprobación de Crédito (POS)",  description: "Autorización para sobregiros y ventas a crédito no habilitadas." },
]

const HUB_TASK_TYPES = [
    { id: "HUB_ORIGIN",   name: "Origen (Confirmación)", description: "Confirmar la orden de venta/compra." },
    { id: "HUB_LOGISTICS", name: "Logística",             description: "Despachar o recepcionar productos." },
    { id: "HUB_BILLING",  name: "Facturación",            description: "Emitir o registrar factura." },
    { id: "HUB_TREASURY", name: "Tesorería",              description: "Registrar pagos y conciliar." },
    { id: "OT_CREATION",  name: "Creación de OT",         description: "Tarea para generar la Orden de Trabajo desde una Nota de Venta o manual." },
]

const RECURRENT_TASK_TYPES = [
    { id: "F29_CREATE",   name: "Creación F29",   description: "Generar la declaración F29 del periodo anterior.",  dayField: "f29_creation_day" },
    { id: "F29_PAY",      name: "Pago F29",        description: "Registrar el pago del F29 del periodo anterior.",   dayField: "f29_payment_day" },
    { id: "PERIOD_CLOSE", name: "Cierre Contable", description: "Realizar el cierre del periodo contable.",           dayField: "period_close_day" },
]

const NOTIFICATION_TYPES = [
    { id: "POS_CREDIT_APPROVAL",    name: "Aprobaciones de Crédito (POS)",        description: "Notificar resultados de solicitudes de crédito." },
    { id: "SUBSCRIPTION_OC_CREATED", name: "Órdenes de Compra (Suscripciones)",   description: "Notificar cuando se generan OCs automáticas." },
    { id: "LOW_MARGIN_ALERT",        name: "Alerta de Margen Bajo",               description: "Notificar cuando el costo de un producto almacenable deja el margen por debajo del umbral." },
]

// ─── Schemas ──────────────────────────────────────────────────────────────────

const assignmentSchema = z.object({
    mode: z.enum(["user", "group"]),
    assigned_user: z.number().nullable(),
    assigned_group: z.string().nullable(),
})
type AssignmentValues = z.infer<typeof assignmentSchema>

const daySchema = z.object({
    value: z.number().int().min(1).max(28),
})
type DayValues = z.infer<typeof daySchema>

const notificationSchema = z.object({
    mode: z.enum(["user", "group"]),
    assigned_user: z.number().nullable(),
    assigned_group: z.string().nullable(),
    notify_creator: z.boolean(),
})
type NotificationValues = z.infer<typeof notificationSchema>

const thresholdSchema = z.object({
    value: z.number().min(0),
})
type ThresholdValues = z.infer<typeof thresholdSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ruleToAssignmentValues(rule: WorkflowRule | undefined): AssignmentValues {
    return {
        mode: (rule?.assigned_user ?? null) !== null ? "user" : "group",
        assigned_user: rule?.assigned_user ?? null,
        assigned_group: rule?.assigned_group ?? null,
    }
}

function notifRuleToValues(rule: NotificationRule | undefined): NotificationValues {
    return {
        mode: rule?.assigned_group ? "group" : "user",
        assigned_user: rule?.assigned_user ?? null,
        assigned_group: rule?.assigned_group ?? null,
        notify_creator: rule?.notify_creator ?? true,
    }
}

// ─── Inline save indicator ────────────────────────────────────────────────────

function RowSaveIndicator({ status }: { status: AutoSaveStatus }) {
    return (
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
            {status === "saving"  && <Loader2     className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {status === "synced"  && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
            {status === "error"   && <AlertCircle  className="h-3.5 w-3.5 text-destructive" />}
            {status === "invalid" && <AlertCircle  className="h-3.5 w-3.5 text-warning" />}
        </div>
    )
}

// ─── AssignmentModeToggle ─────────────────────────────────────────────────────

function AssignmentModeToggle({
    mode,
    onSwitch,
}: {
    mode: "user" | "group"
    onSwitch: (m: "user" | "group") => void
}) {
    return (
        <div className="flex items-center p-0.5 bg-muted rounded-lg border shadow-sm shrink-0 scale-90 sm:scale-100">
            <button
                type="button"
                className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5",
                    mode === "user" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onSwitch("user")}
            >
                <User className="h-3 w-3" /> Usuario
            </button>
            <button
                type="button"
                className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5",
                    mode === "group" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onSwitch("group")}
            >
                <Users className="h-3 w-3" /> Grupo
            </button>
        </div>
    )
}

// ─── AssignmentSelector ───────────────────────────────────────────────────────

function AssignmentSelector({
    mode,
    userValue,
    groupValue,
    onUserChange,
    onGroupChange,
}: {
    mode: "user" | "group"
    userValue: number | null
    groupValue: string | null
    onUserChange: (v: number | null) => void
    onGroupChange: (v: string | null) => void
}) {
    if (mode === "group") {
        return (
            <GroupSelector
                value={groupValue ?? undefined}
                onChange={onGroupChange}
                placeholder="Añadir grupo..."
            />
        )
    }
    return (
        <UserSelector
            value={userValue}
            onChange={onUserChange}
            placeholder="Añadir usuario..."
        />
    )
}

// ─── Row shell ────────────────────────────────────────────────────────────────

function RowShell({
    icon: Icon,
    name,
    description,
    badgeLabel,
    isRecurrent = false,
    children,
}: {
    icon: React.ElementType
    name: string
    description: string
    badgeLabel: string
    isRecurrent?: boolean
    children: React.ReactNode
}) {
    return (
        <div className="group relative bg-card border rounded-lg p-3 hover:shadow-md transition-all">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 min-w-[200px] flex-1">
                    <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
                        <Icon className="h-4 w-4 text-primary/70" />
                    </div>
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold leading-none">{name}</h3>
                            <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono text-muted-foreground uppercase opacity-50">
                                {isRecurrent ? "RECURRENTE" : badgeLabel}
                            </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{description}</p>
                    </div>
                </div>
                {children}
            </div>
        </div>
    )
}

// ─── AssignmentRuleRow ────────────────────────────────────────────────────────

interface AssignmentRuleRowProps {
    taskType: { id: string; name: string; description: string }
    rule: WorkflowRule | undefined
}

const AssignmentRuleRow = React.memo(function AssignmentRuleRow({ taskType, rule }: AssignmentRuleRowProps) {
    const queryClient = useQueryClient()
    const ruleRef = useRef(rule)
    ruleRef.current = rule

    const form = useForm<AssignmentValues>({
        resolver: zodResolver(assignmentSchema),
        defaultValues: ruleToAssignmentValues(rule),
    })

    useEffect(() => {
        if (!form.formState.isDirty) {
            form.reset(ruleToAssignmentValues(ruleRef.current))
        }
    }, [rule, form])

    const onSave = useCallback(async (data: AssignmentValues) => {
        const current = ruleRef.current
        const payload = {
            task_type: taskType.id,
            assigned_user: data.mode === "user" ? data.assigned_user : null,
            assigned_group: data.mode === "group" ? (data.assigned_group ?? "") : "",
        }
        if (current?.id) {
            await api.patch(`/workflow/assignment-rules/${current.id}/`, payload)
        } else {
            await api.post("/workflow/assignment-rules/", payload)
        }
        queryClient.invalidateQueries({ queryKey: workflowKeys.rules() })
    }, [taskType.id, queryClient])

    const { status } = useAutoSaveForm({ form, onSave, debounceMs: 400 })
    const mode = form.watch("mode")
    const userVal = form.watch("assigned_user")
    const groupVal = form.watch("assigned_group")

    const badgeLabel = taskType.id.replace("OT_", "").replace("HUB_", "").replace("_APPROVAL", "")

    return (
        <RowShell icon={Settings} name={taskType.name} description={taskType.description} badgeLabel={badgeLabel}>
            <div className="flex flex-col sm:flex-row items-center gap-3">
                <AssignmentModeToggle
                    mode={mode}
                    onSwitch={(m) => {
                        form.setValue("mode", m)
                        if (m === "user") form.setValue("assigned_group", null)
                        else form.setValue("assigned_user", null)
                    }}
                />
                <div className="w-full sm:w-[220px]">
                    <AssignmentSelector
                        mode={mode}
                        userValue={userVal}
                        groupValue={groupVal}
                        onUserChange={(v) => form.setValue("assigned_user", v)}
                        onGroupChange={(v) => form.setValue("assigned_group", v)}
                    />
                </div>
                <RowSaveIndicator status={status} />
            </div>
        </RowShell>
    )
})

// ─── RecurrentRuleRow ─────────────────────────────────────────────────────────

interface RecurrentRuleRowProps {
    taskType: { id: string; name: string; description: string; dayField: string }
    rule: WorkflowRule | undefined
    dayValue: number | undefined
}

const RecurrentRuleRow = React.memo(function RecurrentRuleRow({ taskType, rule, dayValue }: RecurrentRuleRowProps) {
    const queryClient = useQueryClient()
    const ruleRef = useRef(rule)
    ruleRef.current = rule

    // — Assignment form —
    const assignmentForm = useForm<AssignmentValues>({
        resolver: zodResolver(assignmentSchema),
        defaultValues: ruleToAssignmentValues(rule),
    })

    useEffect(() => {
        if (!assignmentForm.formState.isDirty) {
            assignmentForm.reset(ruleToAssignmentValues(ruleRef.current))
        }
    }, [rule, assignmentForm])

    const onSaveAssignment = useCallback(async (data: AssignmentValues) => {
        const current = ruleRef.current
        const payload = {
            task_type: taskType.id,
            assigned_user: data.mode === "user" ? data.assigned_user : null,
            assigned_group: data.mode === "group" ? (data.assigned_group ?? "") : "",
        }
        if (current?.id) {
            await api.patch(`/workflow/assignment-rules/${current.id}/`, payload)
        } else {
            await api.post("/workflow/assignment-rules/", payload)
        }
        queryClient.invalidateQueries({ queryKey: workflowKeys.rules() })
    }, [taskType.id, queryClient])

    const { status: assignmentStatus } = useAutoSaveForm({ form: assignmentForm, onSave: onSaveAssignment, debounceMs: 400 })

    // — Day form —
    const dayForm = useForm<DayValues>({
        resolver: zodResolver(daySchema),
        defaultValues: { value: dayValue ?? 1 },
    })

    useEffect(() => {
        if (!dayForm.formState.isDirty) {
            dayForm.reset({ value: dayValue ?? 1 })
        }
    }, [dayValue, dayForm])

    const onSaveDay = useCallback(async (data: DayValues) => {
        await api.patch("/workflow/settings/current/", { [taskType.dayField]: data.value })
        queryClient.invalidateQueries({ queryKey: workflowKeys.recurrentSettings() })
    }, [taskType.dayField, queryClient])

    const { status: dayStatus } = useAutoSaveForm({
        form: dayForm,
        onSave: onSaveDay,
        debounceMs: 400,
        validate: (v) =>
            (Number.isFinite(v.value) && Number.isInteger(v.value) && v.value >= 1 && v.value <= 28) ||
            "El día debe estar entre 1 y 28",
    })

    const combinedStatus = useCombinedAutoSaveStatus([assignmentStatus, dayStatus])
    const mode = assignmentForm.watch("mode")
    const userVal = assignmentForm.watch("assigned_user")
    const groupVal = assignmentForm.watch("assigned_group")

    return (
        <RowShell icon={CalendarClock} name={taskType.name} description={taskType.description} badgeLabel="RECURRENTE" isRecurrent>
            <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Day input */}
                <div className="flex items-center gap-2 px-3 py-1 bg-muted/30 rounded-lg border border-border/50">
                    <span className="text-[10px] whitespace-nowrap text-muted-foreground font-medium">Día Gen:</span>
                    <Controller
                        control={dayForm.control}
                        name="value"
                        render={({ field }) => (
                            <Input
                                type="number"
                                min="1"
                                max="28"
                                className="h-7 w-12 text-center text-xs p-0 font-mono"
                                value={field.value}
                                onChange={(e) => field.onChange(
                                    e.target.value === "" ? NaN : parseInt(e.target.value, 10)
                                )}
                            />
                        )}
                    />
                </div>

                <AssignmentModeToggle
                    mode={mode}
                    onSwitch={(m) => {
                        assignmentForm.setValue("mode", m)
                        if (m === "user") assignmentForm.setValue("assigned_group", null)
                        else assignmentForm.setValue("assigned_user", null)
                    }}
                />
                <div className="w-full sm:w-[220px]">
                    <AssignmentSelector
                        mode={mode}
                        userValue={userVal}
                        groupValue={groupVal}
                        onUserChange={(v) => assignmentForm.setValue("assigned_user", v)}
                        onGroupChange={(v) => assignmentForm.setValue("assigned_group", v)}
                    />
                </div>
                <RowSaveIndicator status={combinedStatus} />
            </div>
        </RowShell>
    )
})

// ─── MarginThresholdInput ─────────────────────────────────────────────────────

const MarginThresholdInput = React.memo(function MarginThresholdInput({ initialValue }: { initialValue: number | undefined }) {
    const form = useForm<ThresholdValues>({
        resolver: zodResolver(thresholdSchema),
        defaultValues: { value: initialValue ?? 0 },
    })

    useEffect(() => {
        if (!form.formState.isDirty) {
            form.reset({ value: initialValue ?? 0 })
        }
    }, [initialValue, form])

    const onSave = useCallback(async (data: ThresholdValues) => {
        await api.patch("/workflow/settings/current/", { low_margin_threshold_percent: data.value })
    }, [])

    const { status } = useAutoSaveForm({ form, onSave, debounceMs: 400 })

    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 rounded-lg border border-border/50">
            <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Umbral Mínimo (%)</p>
                <p className="text-[9px] text-muted-foreground leading-none text-right">0 = Apagado</p>
            </div>
            <div className="flex items-center gap-1 relative w-[72px]">
                <Controller
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-8 text-xs text-right pr-5"
                            value={field.value}
                            onChange={(e) => field.onChange(
                                e.target.value === "" ? 0 : parseFloat(e.target.value)
                            )}
                        />
                    )}
                />
                <span className="absolute right-2 text-muted-foreground text-[10px] font-medium">%</span>
            </div>
            <RowSaveIndicator status={status} />
        </div>
    )
})

// ─── NotificationRuleRow ──────────────────────────────────────────────────────

interface NotificationRuleRowProps {
    type: { id: string; name: string; description: string }
    rule: NotificationRule | undefined
    recurrentSettings: WorkflowRecurrentSettings | undefined
}

const NotificationRuleRow = React.memo(function NotificationRuleRow({ type, rule, recurrentSettings }: NotificationRuleRowProps) {
    const queryClient = useQueryClient()
    const ruleRef = useRef(rule)
    ruleRef.current = rule

    const form = useForm<NotificationValues>({
        resolver: zodResolver(notificationSchema),
        defaultValues: notifRuleToValues(rule),
    })

    useEffect(() => {
        if (!form.formState.isDirty) {
            form.reset(notifRuleToValues(ruleRef.current))
        }
    }, [rule, form])

    const onSave = useCallback(async (data: NotificationValues) => {
        const current = ruleRef.current
        const payload = {
            notification_type: type.id,
            assigned_user: data.mode === "user" ? data.assigned_user : null,
            assigned_group: data.mode === "group" ? (data.assigned_group ?? null) : null,
            notify_creator: data.notify_creator,
        }
        if (current?.id) {
            await api.patch(`/workflow/notification-rules/${current.id}/`, payload)
        } else {
            await api.post("/workflow/notification-rules/", payload)
        }
        queryClient.invalidateQueries({ queryKey: workflowKeys.notificationRules() })
    }, [type.id, queryClient])

    const { status } = useAutoSaveForm({ form, onSave, debounceMs: 400 })
    const mode = form.watch("mode")
    const userVal = form.watch("assigned_user")
    const groupVal = form.watch("assigned_group")

    return (
        <div className="group relative bg-card border rounded-lg p-4 hover:shadow-md transition-all">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex items-center gap-4 min-w-[250px] flex-1">
                    <BellRing className="h-5 w-5 text-muted-foreground/70" />
                    <div className="space-y-1">
                        <h3 className="text-sm font-bold leading-none">{type.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{type.description}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                    {/* Threshold — LOW_MARGIN_ALERT only */}
                    {type.id === "LOW_MARGIN_ALERT" && (
                        <MarginThresholdInput initialValue={recurrentSettings?.low_margin_threshold_percent} />
                    )}

                    {/* Notify creator toggle — POS_CREDIT_APPROVAL only */}
                    {type.id === "POS_CREDIT_APPROVAL" && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 rounded-lg border border-border/50">
                            <div className="space-y-0.5">
                                <Label className="text-[10px] font-bold uppercase tracking-tight">Notificar Creador</Label>
                                <p className="text-[9px] text-muted-foreground leading-none">Quien inició acción</p>
                            </div>
                            <Controller
                                control={form.control}
                                name="notify_creator"
                                render={({ field }) => (
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                )}
                            />
                        </div>
                    )}

                    {/* Additional notifiers (user/group) */}
                    <div className="flex items-center gap-3">
                        {type.id === "POS_CREDIT_APPROVAL" && (
                            <div className="space-y-0.5 min-w-[120px]">
                                <Label className="text-[10px] font-bold uppercase tracking-tight">Notificadores Extra</Label>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <AssignmentModeToggle
                                mode={mode}
                                onSwitch={(m) => {
                                    form.setValue("mode", m)
                                    if (m === "user") form.setValue("assigned_group", null)
                                    else form.setValue("assigned_user", null)
                                }}
                            />
                            <div className="w-[200px]">
                                <AssignmentSelector
                                    mode={mode}
                                    userValue={userVal}
                                    groupValue={groupVal}
                                    onUserChange={(v) => form.setValue("assigned_user", v)}
                                    onGroupChange={(v) => form.setValue("assigned_group", v)}
                                />
                            </div>
                        </div>
                    </div>

                    <RowSaveIndicator status={status} />
                </div>
            </div>
        </div>
    )
})

// ─── WorkflowSettings ─────────────────────────────────────────────────────────

interface WorkflowSettingsProps {
    activeTab: string
}

export function WorkflowSettings({ activeTab }: WorkflowSettingsProps) {
    const { data: rules = [], isLoading: rulesLoading } = useWorkflowRulesQuery()
    const { data: notifRules = [], isLoading: notifLoading } = useNotificationRulesQuery()
    const { data: recurrentSettings, isLoading: recurrentLoading } = useWorkflowRecurrentSettingsQuery()

    const isLoading = rulesLoading || notifLoading || recurrentLoading

    if (isLoading) {
        return (
            <div className="space-y-6">
                <CardSkeleton count={5} variant="list" />
            </div>
        )
    }

    const ruleByType = Object.fromEntries(rules.map((r) => [r.task_type, r]))
    const notifByType = Object.fromEntries(notifRules.map((r) => [r.notification_type, r]))

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} className="space-y-4">

                <TabsContent value="approvals">
                    <div className="grid gap-2">
                        {TASK_TYPES.map((type) => (
                            <AssignmentRuleRow key={type.id} taskType={type} rule={ruleByType[type.id]} />
                        ))}
                    </div>
                    <Card className="border-dashed border-2 bg-muted/5 mt-4">
                        <CardHeader>
                            <CardTitle className="text-sm">Nota sobre Asignaciones</CardTitle>
                            <CardDescription className="text-xs">
                                Si se selecciona un <strong>Usuario</strong>, la tarea se asignará directamente a él.
                                <br />
                                Si se selecciona un <strong>Grupo</strong>, la tarea quedará en un &quot;Pool&quot; visible para todos los miembros de ese grupo, y cualquiera podrá tomarla.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </TabsContent>

                <TabsContent value="tasks" className="space-y-6">
                    <div>
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Tareas por Etapa (HUB)</h4>
                        <div className="grid gap-2">
                            {HUB_TASK_TYPES.map((type) => (
                                <AssignmentRuleRow key={type.id} taskType={type} rule={ruleByType[type.id]} />
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border/50">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Tareas Recurrentes mensuales</h4>
                        <div className="grid gap-2">
                            {RECURRENT_TASK_TYPES.map((type) => (
                                <RecurrentRuleRow
                                    key={type.id}
                                    taskType={type}
                                    rule={ruleByType[type.id]}
                                    dayValue={recurrentSettings?.[type.dayField]}
                                />
                            ))}
                        </div>
                    </div>

                    <Card className="border-dashed border-2 bg-muted/5 mt-4">
                        <CardHeader className="py-4">
                            <CardTitle className="text-xs">Automatización de Tareas</CardTitle>
                            <CardDescription className="text-[10px]">
                                Las tareas se generan y completan automáticamente según el flujo del sistema.
                                <br />
                                Para tareas recurrentes, el <strong>Día Gen</strong> indica cuándo se creará la tarea para el periodo anterior.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </TabsContent>

                <TabsContent value="notif" className="space-y-6">
                    <div className="space-y-1 px-1">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reglas de Notificación</h4>
                        <p className="text-xs text-muted-foreground">Configure quién recibe las alertas de campana para eventos clave del sistema.</p>
                    </div>

                    <div className="grid gap-4">
                        {NOTIFICATION_TYPES.map((type) => (
                            <NotificationRuleRow
                                key={type.id}
                                type={type}
                                rule={notifByType[type.id]}
                                recurrentSettings={recurrentSettings}
                            />
                        ))}
                    </div>

                    <Card className="border-dashed border-2 bg-muted/5 mt-4">
                        <CardHeader className="py-4">
                            <CardTitle className="text-xs flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-primary" />
                                Lógica de Notificaciones
                            </CardTitle>
                            <CardDescription className="text-[10px] space-y-2">
                                <p>
                                    Si activa <strong>Notificar Creador</strong>, el usuario que inició el proceso recibirá la respuesta (ej: el cajero que solicitó crédito).
                                </p>
                                <p>
                                    Los <strong>Notificadores Extra</strong> permiten que supervisores o equipos completos (vía Grupos) estén al tanto de lo que sucede, ideal para monitoreo o auditoría.
                                </p>
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
