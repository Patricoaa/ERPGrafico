"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UserSelector } from "@/components/selectors/UserSelector"
import { GroupSelector } from "@/components/selectors/GroupSelector"
import { Settings, Save, AlertCircle, CheckCircle2, User, Users, CloudUpload, Check } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { Input } from "@/components/ui/input"
import { LucideIcon, CalendarClock, CreditCard, Lock, Bell, BellRing, UserCheck } from "lucide-react"
import { Switch } from "@/components/ui/switch"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkflowRule, NotificationRule } from "@/types/entities"

/** Shape of the /workflow/settings/current/ response */
interface WorkflowRecurrentSettings {
    f29_creation_day?: number
    f29_payment_day?: number
    period_close_day?: number
    low_margin_threshold_percent?: number
    [key: string]: number | undefined
}

const TASK_TYPES = [
    { id: 'OT_MATERIAL_APPROVAL', name: 'Aprobación de Stock', description: 'Validación de existencia de materiales.' },
    { id: 'OT_PREPRESS_APPROVAL', name: 'Pre-Prensa (Diseño)', description: 'Validación de archivos de diseño.' },
    { id: 'OT_PRESS_APPROVAL', name: 'Prensa (Impresión)', description: 'Validación de salida de prensa.' },
    { id: 'OT_POSTPRESS_APPROVAL', name: 'Post-Prensa (Terminado)', description: 'Validación de acabados finales.' },
    { id: 'OT_OUTSOURCING_VERIFICATION_APPROVAL', name: 'Verificación Tercerizados', description: 'Recepción de trabajos externos.' },
    { id: 'CREDIT_POS_REQUEST', name: 'Aprobación de Crédito (POS)', description: 'Autorización para sobregiros y ventas a crédito no habilitadas.' },
]

const HUB_TASK_TYPES = [
    { id: 'HUB_ORIGIN', name: 'Origen (Confirmación)', description: 'Confirmar la orden de venta/compra.' },
    { id: 'HUB_LOGISTICS', name: 'Logística', description: 'Despachar o recepcionar productos.' },
    { id: 'HUB_BILLING', name: 'Facturación', description: 'Emitir o registrar factura.' },
    { id: 'HUB_TREASURY', name: 'Tesorería', description: 'Registrar pagos y conciliar.' },
    { id: 'OT_CREATION', name: 'Creación de OT', description: 'Tarea para generar la Orden de Trabajo desde una Nota de Venta o manual.' },
]

const RECURRENT_TASK_TYPES = [
    { id: 'F29_CREATE', name: 'Creación F29', description: 'Generar la declaración F29 del periodo anterior.', dayField: 'f29_creation_day' },
    { id: 'F29_PAY', name: 'Pago F29', description: 'Registrar el pago del F29 del periodo anterior.', dayField: 'f29_payment_day' },
    { id: 'PERIOD_CLOSE', name: 'Cierre Contable', description: 'Realizar el cierre del periodo contable.', dayField: 'period_close_day' },
]

const NOTIFICATION_TYPES = [
    { id: 'POS_CREDIT_APPROVAL', name: 'Aprobaciones de Crédito (POS)', description: 'Notificar resultados de solicitudes de crédito.' },
    { id: 'SUBSCRIPTION_OC_CREATED', name: 'Órdenes de Compra (Suscripciones)', description: 'Notificar cuando se generan OCs automáticas.' },
    { id: 'LOW_MARGIN_ALERT', name: 'Alerta de Margen Bajo', description: 'Notificar cuando el costo de un producto almacenable deja el margen por debajo del umbral.' },
]

interface WorkflowSettingsProps {
    activeTab: string
}

export function WorkflowSettings({ activeTab }: WorkflowSettingsProps) {
    const [rules, setRules] = useState<WorkflowRule[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [uiModes, setUiModes] = useState<Record<string, 'user' | 'group'>>({})
    const [recurrentSettings, setRecurrentSettings] = useState<WorkflowRecurrentSettings | null>(null)
    const [recurrentLoading, setRecurrentLoading] = useState(false)
    const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([])

    const fetchRules = async () => {
        try {
            const res = await api.get('/workflow/assignment-rules/')
            const fetchedRules = res.data.results || res.data
            setRules(fetchedRules)

            // Sync UI modes from fetched rules
            const modes: Record<string, 'user' | 'group'> = {}
            fetchedRules.forEach((r: WorkflowRule) => {
                modes[r.task_type] = r.assigned_user === null ? 'group' : 'user'
            })
            setUiModes(prev => ({ ...modes, ...prev }))
        } catch (e) {
            toast.error("No se pudieron cargar las reglas de asignación")
        } finally {
            setLoading(false)
        }
    }

    const fetchRecurrentSettings = async () => {
        setRecurrentLoading(true)
        try {
            const res = await api.get('/workflow/settings/current/')
            setRecurrentSettings(res.data)
        } catch (e) {
            toast.error("Error al cargar configuración recurrente")
        } finally {
            setRecurrentLoading(false)
        }
    }

    const fetchNotificationRules = async () => {
        try {
            const res = await api.get('/workflow/notification-rules/')
            setNotificationRules(res.data.results || res.data)
        } catch (e) {
            console.error(e)
        }
    }

    useEffect(() => {
        fetchRules()
        fetchRecurrentSettings()
        fetchNotificationRules()
    }, [])

    const handleUpdateRule = async (taskType: string, value: string | number | null, isGroup: boolean) => {
        setSaving(taskType)
        // Update local UI mode immediately for better UX
        setUiModes(prev => ({ ...prev, [taskType]: isGroup ? 'group' : 'user' }))

        try {
            const existingRule = rules.find(r => r.task_type === taskType)
            const payload = {
                task_type: taskType,
                assigned_user: isGroup ? null : value,
                assigned_group: isGroup ? (value || "") : ""
            }

            if (existingRule) {
                await api.patch(`/workflow/assignment-rules/${existingRule.id}/`, payload)
            } else {
                await api.post('/workflow/assignment-rules/', payload)
            }
            toast.success("Regla actualizada")
            fetchRules()
        } catch (e) {
            toast.error("Error al actualizar la regla")
        } finally {
            setSaving(null)
        }
    }

    const handleUpdateRecurrentSetting = async (field: string, value: string) => {
        const numVal = parseInt(value)
        if (isNaN(numVal) || numVal < 1 || numVal > 28) {
            toast.error("El día debe estar entre 1 y 28")
            return
        }

        setSaving(field)
        try {
            const res = await api.patch('/workflow/settings/current/', { [field]: numVal })
            setRecurrentSettings(res.data)
            toast.success("Configuración guardada")
        } catch (e) {
            toast.error("Error al guardar configuración")
        } finally {
            setSaving(null)
        }
    }

    const handleUpdateNotificationRule = async (notifType: string, field: string, value: string | number | boolean | null) => {
        setSaving(`${notifType}-${field}`)
        try {
            const existingRule = notificationRules.find((r: NotificationRule) => r.notification_type === notifType)
            const payload = {
                notification_type: notifType,
                [field]: value
            }

            if (existingRule) {
                await api.patch(`/workflow/notification-rules/${existingRule.id}/`, payload)
            } else {
                await api.post('/workflow/notification-rules/', payload)
            }
            fetchNotificationRules()
        } catch (e) {
            toast.error("Error al actualizar la regla de notificación")
        } finally {
            setSaving(null)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid gap-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-4 p-3 border rounded-lg bg-card/50">
                            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-3 w-1/2 opacity-50" />
                            </div>
                            <Skeleton className="h-10 w-48 shrink-0" />
                            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }


    const renderRuleRows = (taskTypes: { id: string; name: string; description: string; dayField?: string }[]) => (
        <div className="grid gap-2">
            {taskTypes.map((type) => {
                const rule = rules.find(r => r.task_type === type.id)
                const currentMode = uiModes[type.id] || (rule?.assigned_user === null ? 'group' : 'user')
                const isGroupMode = currentMode === 'group'
                const isRecurrent = !!type.dayField

                return (
                    <div key={type.id} className="group relative bg-card border rounded-lg p-3 hover:shadow-md transition-all">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            {/* Stage identification */}
                            <div className="flex items-center gap-3 min-w-[200px] flex-1">
                                <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
                                    {isRecurrent ? (
                                        <CalendarClock className="h-4 w-4 text-primary/70" />
                                    ) : (
                                        <Settings className="h-4 w-4 text-primary/70" />
                                    )}
                                </div>
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold leading-none">{type.name}</h3>
                                        <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono text-muted-foreground uppercase opacity-50">
                                            {isRecurrent ? 'RECURRENTE' : type.id.replace('OT_', '').replace('HUB_', '').replace('_APPROVAL', '')}
                                        </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1">{type.description}</p>
                                </div>
                            </div>

                            {/* Recurrent Day Configuration */}
                            {isRecurrent && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-muted/30 rounded-lg border border-border/50">
                                    <Label className="text-[10px] whitespace-nowrap">Día Gen:</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="28"
                                        className="h-7 w-12 text-center text-xs p-0 font-mono"
                                        defaultValue={recurrentSettings?.[type.dayField]}
                                        onBlur={(e) => handleUpdateRecurrentSetting(type.dayField, e.target.value)}
                                        disabled={saving === type.dayField}
                                    />
                                </div>
                            )}

                            {/* Controls */}
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                {/* Selector Toggle */}
                                <div className="flex items-center p-0.5 bg-muted rounded-lg border shadow-sm shrink-0 scale-90 sm:scale-100">
                                    <button
                                        className={cn(
                                            "px-2 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5",
                                            !isGroupMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                        onClick={() => handleUpdateRule(type.id, null, false)}
                                        disabled={saving === type.id}
                                    >
                                        <User className="h-3 w-3" />
                                        Usuario
                                    </button>
                                    <button
                                        className={cn(
                                            "px-2 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5",
                                            isGroupMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                        onClick={() => handleUpdateRule(type.id, "", true)}
                                        disabled={saving === type.id}
                                    >
                                        <Users className="h-3 w-3" />
                                        Grupo
                                    </button>
                                </div>

                                {/* Assignment Selector */}
                                <div className="w-full sm:w-[220px]">
                                    {isGroupMode ? (
                                        <GroupSelector
                                            value={rule?.assigned_group}
                                            onChange={(val) => handleUpdateRule(type.id, val, true)}
                                            disabled={saving === type.id}
                                            placeholder="Añadir grupo..."
                                        />
                                    ) : (
                                        <UserSelector
                                            value={rule?.assigned_user ? parseInt(rule.assigned_user) : null}
                                            onChange={(val: number | null) => handleUpdateRule(type.id, val, false)}
                                            disabled={saving === type.id}
                                            placeholder="Añadir usuario..."
                                        />
                                    )}
                                </div>

                                {/* Status Badge (Compact) */}
                                <div className="shrink-0 flex items-center">
                                    {rule?.assigned_user ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                    ) : rule?.assigned_group ? (
                                        <Users className="h-4 w-4" />
                                    ) : (
                                        <AlertCircle className="h-4 w-4" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )

    const renderNotificationRuleRows = () => (
        <div className="grid gap-4">
            {NOTIFICATION_TYPES.map((type) => {
                const rule = notificationRules.find((r: any) => r.notification_type === type.id)
                const isGroupMode = !!rule?.assigned_group && !rule?.assigned_user

                return (
                    <div key={type.id} className="group relative bg-card border rounded-lg p-4 hover:shadow-md transition-all">
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="flex items-center gap-4 min-w-[250px] flex-1">
                                <BellRing className="h-5 w-5 text-muted-foreground/70" />
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold leading-none">{type.name}</h3>
                                    <p className="text-xs text-muted-foreground line-clamp-1">{type.description}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-6">
                                {/* Conditional Margin Threshold Input */}
                                {type.id === 'LOW_MARGIN_ALERT' && (
                                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 rounded-lg border border-border/50">
                                        <div className="space-y-0.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-tight">Umbral Mínimo (%)</Label>
                                            <p className="text-[9px] text-muted-foreground leading-none text-right">0 = Apagado</p>
                                        </div>
                                        <div className="flex items-center gap-1 relative w-[72px]">
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="h-8 text-xs text-right pr-5"
                                                defaultValue={recurrentSettings?.low_margin_threshold_percent}
                                                onBlur={(e) => handleUpdateRecurrentSetting('low_margin_threshold_percent', e.target.value)}
                                                disabled={saving === 'low_margin_threshold_percent'}
                                            />
                                            <span className="absolute right-2 text-muted-foreground text-[10px] font-medium">%</span>
                                        </div>
                                    </div>
                                )}

                                {/* Conditional Creator Toggle */}
                                {type.id === 'POS_CREDIT_APPROVAL' && (
                                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 rounded-lg border border-border/50">
                                        <div className="space-y-0.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-tight">Notificar Creador</Label>
                                            <p className="text-[9px] text-muted-foreground leading-none">Quien inició acción</p>
                                        </div>
                                        <Switch
                                            checked={rule ? rule.notify_creator : true}
                                            onCheckedChange={(val) => handleUpdateNotificationRule(type.id, 'notify_creator', val)}
                                            disabled={saving === `${type.id}-notify_creator`}
                                        />
                                    </div>
                                )}

                                {/* Additional Notifiers */}
                                <div className="flex items-center gap-3">
                                    {type.id === 'POS_CREDIT_APPROVAL' && (
                                        <div className="space-y-0.5 min-w-[120px]">
                                            <Label className="text-[10px] font-bold uppercase tracking-tight">Notificadores Extra</Label>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center p-0.5 bg-muted rounded-lg border shadow-sm scale-90">
                                            <button
                                                className={cn(
                                                    "px-2 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5",
                                                    !isGroupMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                )}
                                                onClick={() => handleUpdateNotificationRule(type.id, 'assigned_group', null)}
                                            >
                                                <User className="h-3 w-3" /> Usuario
                                            </button>
                                            <button
                                                className={cn(
                                                    "px-2 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5",
                                                    isGroupMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                )}
                                                onClick={() => handleUpdateNotificationRule(type.id, 'assigned_user', null)}
                                            >
                                                <Users className="h-3 w-3" /> Grupo
                                            </button>
                                        </div>

                                        <div className="w-[200px]">
                                            {isGroupMode ? (
                                                <GroupSelector
                                                    value={rule?.assigned_group}
                                                    onChange={(val) => handleUpdateNotificationRule(type.id, 'assigned_group', val)}
                                                    placeholder="Añadir grupo..."
                                                />
                                            ) : (
                                                <UserSelector
                                                    value={rule?.assigned_user ? parseInt(rule.assigned_user) : null}
                                                    onChange={(val: number | null) => handleUpdateNotificationRule(type.id, 'assigned_user', val)}
                                                    placeholder="Añadir usuario..."
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} className="space-y-4">

                <TabsContent value="approvals">
                    {renderRuleRows(TASK_TYPES)}

                    <Card className="border-dashed border-2 bg-muted/5 mt-4">
                        <CardHeader>
                            <CardTitle className="text-sm">Nota sobre Asignaciones</CardTitle>
                            <CardDescription className="text-xs">
                                Si se selecciona un <strong>Usuario</strong>, la tarea se asignará directamente a él.
                                <br />
                                Si se selecciona un <strong>Grupo</strong>, la tarea quedará en un "Pool" visible para todos los miembros de ese grupo, y cualquiera podrá tomarla.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </TabsContent>

                <TabsContent value="tasks" className="space-y-6">
                    <div>
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Tareas por Etapa (HUB)</h4>
                        {renderRuleRows(HUB_TASK_TYPES)}
                    </div>

                    <div className="pt-4 border-t border-border/50">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Tareas Recurrentes mensuales</h4>
                        {renderRuleRows(RECURRENT_TASK_TYPES)}
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

                    {renderNotificationRuleRows()}

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
