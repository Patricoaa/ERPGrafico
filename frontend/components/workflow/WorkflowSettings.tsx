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
    { id: 'OT_MATERIAL_APPROVAL', name: 'Aprobación de Stock', description: 'Validación de existencia de materiales.' },
    { id: 'OT_PREPRESS_APPROVAL', name: 'Pre-Prensa (Diseño)', description: 'Validación de archivos de diseño.' },
    { id: 'OT_PRESS_APPROVAL', name: 'Prensa (Impresión)', description: 'Validación de salida de prensa.' },
    { id: 'OT_POSTPRESS_APPROVAL', name: 'Post-Prensa (Terminado)', description: 'Validación de acabados finales.' },
    { id: 'OT_OUTSOURCING_VERIFICATION_APPROVAL', name: 'Verificación Tercerizados', description: 'Recepción de trabajos externos.' },
]

export function WorkflowSettings() {
    const [rules, setRules] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [uiModes, setUiModes] = useState<Record<string, 'user' | 'group'>>({})

    const fetchRules = async () => {
        try {
            const res = await api.get('/workflow/assignment-rules/')
            const fetchedRules = res.data.results || res.data
            setRules(fetchedRules)

            // Sync UI modes from fetched rules
            const modes: Record<string, 'user' | 'group'> = {}
            fetchedRules.forEach((r: any) => {
                modes[r.task_type] = r.assigned_user === null ? 'group' : 'user'
            })
            setUiModes(prev => ({ ...modes, ...prev }))
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

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground italic">Cargando configuración...</div>
    }

    return (
        <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-2">
                <div className="space-y-0.5">
                    <h2 className="text-xl font-bold tracking-tight">Configuración de Workflow</h2>
                    <p className="text-muted-foreground text-xs">
                        Defina los responsables por defecto para cada etapa.
                    </p>
                </div>
            </div>

            <div className="grid gap-2">
                {TASK_TYPES.map((type) => {
                    const rule = rules.find(r => r.task_type === type.id)
                    const currentMode = uiModes[type.id] || (rule?.assigned_user === null ? 'group' : 'user')
                    const isGroupMode = currentMode === 'group'

                    return (
                        <div key={type.id} className="group relative bg-card border rounded-xl p-3 hover:shadow-md transition-all">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                {/* Stage identification */}
                                <div className="flex items-center gap-3 min-w-[200px] flex-1">
                                    <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
                                        <Settings className="h-4 w-4 text-primary/70" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold leading-none">{type.name}</h3>
                                            <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono text-muted-foreground uppercase opacity-50">
                                                {type.id.replace('OT_', '').replace('_APPROVAL', '')}
                                            </Badge>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground line-clamp-1">{type.description}</p>
                                    </div>
                                </div>

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
                                    <div className="w-full sm:w-[280px]">
                                        {isGroupMode ? (
                                            <GroupSelector
                                                value={rule?.assigned_group}
                                                onChange={(val) => handleUpdateRule(type.id, val, true)}
                                                disabled={saving === type.id}
                                                placeholder="Sel. grupo..."
                                            />
                                        ) : (
                                            <UserSelector
                                                value={rule?.assigned_user ? parseInt(rule.assigned_user) : null}
                                                onChange={(val: any) => handleUpdateRule(type.id, val, false)}
                                                disabled={saving === type.id}
                                                placeholder="Sel. usuario..."
                                            />
                                        )}
                                    </div>

                                    {/* Status Badge (Compact) */}
                                    <div className="shrink-0 flex items-center">
                                        {rule?.assigned_user ? (
                                            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-green-50 text-green-600 border border-green-100" title={`Asignado a: ${rule.assigned_user_data?.username}`}>
                                                <CheckCircle2 className="h-4 w-4" />
                                            </div>
                                        ) : rule?.assigned_group ? (
                                            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100" title={`Grupo: ${rule.assigned_group}`}>
                                                <Users className="h-4 w-4" />
                                            </div>
                                        ) : (
                                            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-100" title="Sin asignar">
                                                <AlertCircle className="h-4 w-4" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
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
