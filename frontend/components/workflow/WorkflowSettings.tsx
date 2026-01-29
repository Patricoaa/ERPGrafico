"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UserSelector } from "../selectors/UserSelector"
import { GroupSelector } from "../selectors/GroupSelector"
import { Settings, Save, AlertCircle, CheckCircle2, User, Users } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

import { cn } from "@/lib/utils"

const TASK_TYPES = [
    { id: 'OT_PREPRESS_APPROVAL', name: 'Aprobación Pre-Prensa (Diseño)', description: 'Validación de diseño y archivos para OT avanzada.' },
    { id: 'OT_PRESS_APPROVAL', name: 'Aprobación Prensa (Impresión)', description: 'Validación de salida de prensa y calidad de color.' },
    { id: 'OT_POSTPRESS_APPROVAL', name: 'Aprobación Post-Prensa', description: 'Validación de acabados y empaque final.' },
]

export function WorkflowSettings() {
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

    const handleUpdateRule = async (taskType: string, value: any, isGroup: boolean) => {
        setSaving(taskType)
        try {
            const existingRule = rules.find(r => r.task_type === taskType)
            const payload = {
                task_type: taskType,
                assigned_user: isGroup ? null : value,
                assigned_group: isGroup ? value : ""
            }

            if (existingRule) {
                await api.patch(`/workflow/assignment-rules/${existingRule.id}/`, payload)
            } else {
                await api.post('/workflow/assignment-rules/', payload)
            }
            toast.success("Regla actualizada correctamente")
            fetchRules()
        } catch (e) {
            toast.error("Error al actualizar la regla")
        } finally {
            setSaving(null)
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground italic">Cargando configuración...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">Configuración de Workflow</h2>
                    <p className="text-muted-foreground text-sm">
                        Configure quién debe aprobar cada etapa de la producción por defecto.
                    </p>
                </div>
            </div>

            <div className="grid gap-6">
                {TASK_TYPES.map((type) => {
                    const rule = rules.find(r => r.task_type === type.id)
                    const isGroupAssigned = !!rule?.assigned_group
                    // Local state for toggle could be tricky if we want to default to what's saved
                    // We can derive "mode" from the rule data
                    const currentMode = isGroupAssigned ? 'group' : 'user'

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
                                            <CardDescription className="text-xs">{type.description}</CardDescription>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                        {type.id}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="flex flex-col md:flex-row md:items-end gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-muted-foreground">Asignar a:</span>
                                            <div className="flex items-center border rounded-lg p-1 bg-background">
                                                <button
                                                    className={cn(
                                                        "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                                        !isGroupAssigned ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
                                                    )}
                                                    onClick={() => handleUpdateRule(type.id, null, false)} // Reset to User mode (clears group)
                                                    disabled={saving === type.id}
                                                >
                                                    Usuario
                                                </button>
                                                <button
                                                    className={cn(
                                                        "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                                        isGroupAssigned ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
                                                    )}
                                                    onClick={() => handleUpdateRule(type.id, "", true)} // Reset to Group mode (clears user)
                                                    disabled={saving === type.id}
                                                >
                                                    Grupo / Rol
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2">
                                                {isGroupAssigned ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                                                {isGroupAssigned ? "Grupo Responsable" : "Usuario Responsable"}
                                            </Label>

                                            {isGroupAssigned ? (
                                                <GroupSelector
                                                    value={rule?.assigned_group}
                                                    onChange={(val) => handleUpdateRule(type.id, val, true)}
                                                    disabled={saving === type.id}
                                                    placeholder="Seleccionar grupo o rol..."
                                                />
                                            ) : (
                                                <UserSelector
                                                    value={rule?.assigned_user ? parseInt(rule.assigned_user) : null}
                                                    onChange={(val: any) => handleUpdateRule(type.id, val, false)}
                                                    disabled={saving === type.id}
                                                    placeholder="Seleccionar usuario..."
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="shrink-0">
                                        {rule?.assigned_user ? (
                                            <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Usuario: {rule.assigned_user_data?.username}
                                            </div>
                                        ) : rule?.assigned_group ? (
                                            <div className="flex items-center gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                                                <Users className="h-4 w-4" />
                                                Grupo: {rule.assigned_group}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-amber-600 text-sm font-medium bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                                                <AlertCircle className="h-4 w-4" />
                                                Sin asignar
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
                        Si se selecciona un <strong>Usuario</strong>, la tarea se asignará directamente a él.
                        <br />
                        Si se selecciona un <strong>Grupo</strong>, la tarea quedará en un "Pool" visible para todos los miembros de ese grupo, y cualquiera podrá tomarla.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    )
}
