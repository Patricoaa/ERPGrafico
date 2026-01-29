"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UserSelector } from "@/components/selectors/UserSelector"
import { Settings, Save, AlertCircle, CheckCircle2, User } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

const TASK_TYPES = [
    { id: 'OT_PREPRESS_APPROVAL', name: 'Aprobación Pre-Prensa (Diseño)', description: 'Validación de diseño y archivos para OT avanzada.' },
    { id: 'OT_PRESS_APPROVAL', name: 'Aprobación Prensa (Impresión)', description: 'Validación de salida de prensa y calidad de color.' },
    { id: 'OT_POSTPRESS_APPROVAL', name: 'Aprobación Post-Prensa', description: 'Validación de acabados y empaque final.' },
]

export default function WorkflowSettings() {
    const [rules, setRules] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)

    const fetchRules = async () => {
        try {
            const res = await api.get('/workflow/assignment-rules/')
            setRules(res.data.results || res.data)
        } catch (e) {
            toast.error("No se pudieron cargar las reglas de asignación")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRules()
    }, [])

    const handleUpdateRule = async (taskType: string, userId: string | null) => {
        setSaving(taskType)
        try {
            const existingRule = rules.find(r => r.task_type === taskType)
            if (existingRule) {
                await api.patch(`/workflow/assignment-rules/${existingRule.id}/`, {
                    assigned_user: userId
                })
            } else {
                await api.post('/workflow/assignment-rules/', {
                    task_type: taskType,
                    assigned_user: userId
                })
            }
            toast.success("Regla actualizada correctamente")
            fetchRules()
        } catch (e) {
            toast.error("Error al actualizar la regla")
        } finally {
            setSaving(null)
        }
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Configuración de Workflow</h2>
                    <p className="text-muted-foreground">
                        Configure quién debe aprobar cada etapa de la producción por defecto.
                    </p>
                </div>
            </div>

            <div className="grid gap-6">
                {TASK_TYPES.map((type) => {
                    const rule = rules.find(r => r.task_type === type.id)
                    return (
                        <Card key={type.id} className="overflow-hidden border-primary/10 hover:border-primary/20 transition-colors">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Settings className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{type.name}</CardTitle>
                                            <CardDescription>{type.description}</CardDescription>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                        {type.id}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="flex flex-col md:flex-row md:items-end gap-6">
                                    <div className="flex-1 space-y-2">
                                        <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2">
                                            <User className="h-3.5 w-3.5" /> Usuario Responsable por Defecto
                                        </Label>
                                        <UserSelector
                                            value={rule?.assigned_user?.toString() || ""}
                                            onChange={(val) => handleUpdateRule(type.id, val)}
                                            disabled={saving === type.id}
                                            placeholder="Seleccionar usuario para asignación automática..."
                                        />
                                    </div>
                                    <div className="shrink-0">
                                        {rule?.assigned_user ? (
                                            <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Configurado: {rule.assigned_user_data?.username}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-amber-600 text-sm font-medium bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                                                <AlertCircle className="h-4 w-4" />
                                                Sin asignar (Manual)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <Card className="border-dashed border-2 bg-muted/5">
                <CardHeader>
                    <CardTitle className="text-sm">Nota sobre Asignaciones</CardTitle>
                    <CardDescription className="text-xs">
                        Si no se configura un usuario por defecto, la tarea se creará sin responsable y deberá ser asignada manualmente desde el panel de tareas o la propia OT.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    )
}
