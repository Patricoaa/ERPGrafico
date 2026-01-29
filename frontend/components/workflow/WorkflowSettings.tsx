"use client"

import { useState, useEffect } from "react"
import { getAssignmentRules, updateAssignmentRule, createAssignmentRule, TaskAssignmentRule } from "@/lib/workflow/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector" // Could reuse this selector style logic or build a UserSelector
// Note: We need a UserSelector. Usually we have one, if not I'll just use a simple mock/select or query users.
// For now, let's assume we can fetch users list for a dropdown or similar.
import api from "@/lib/api"
import { toast } from "sonner"
import { Plus, Save, Trash2, Edit } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { UserSelector } from "@/components/selectors/UserSelector" // Assuming this exists or I will create it

export function WorkflowSettings() {
    const [rules, setRules] = useState<TaskAssignmentRule[]>([])
    const [loading, setLoading] = useState(true)

    // Edit state
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<Partial<TaskAssignmentRule>>({})

    const fetchRules = async () => {
        setLoading(true)
        try {
            const res = await getAssignmentRules()
            const list = Array.isArray(res) ? res : (res.results || [])
            setRules(list)
        } catch (e) {
            toast.error("Error cargando reglas")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRules()
    }, [])

    const handleSave = async () => {
        try {
            if (editingRule.id) {
                await updateAssignmentRule(editingRule.id, {
                    assigned_user: editingRule.assigned_user,
                    description: editingRule.description
                })
                toast.success("Regla actualizada")
            } else {
                await createAssignmentRule(editingRule)
                toast.success("Regla creada")
            }
            setIsEditOpen(false)
            fetchRules()
        } catch (error) {
            toast.error("Error al guardar regla")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Asignación de Tareas</h3>
                    <p className="text-sm text-muted-foreground">Configura quién es responsable de cada tipo de tarea automática.</p>
                </div>
                <Button onClick={() => { setEditingRule({}); setIsEditOpen(true) }}>
                    <Plus className="mr-2 h-4 w-4" />Nueva Regla
                </Button>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tipo de Tarea (Código)</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Usuario Asignado</TableHead>
                            <TableHead className="w-[100px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.map((rule) => (
                            <TableRow key={rule.id}>
                                <TableCell className="font-medium font-mono text-xs">{rule.task_type}</TableCell>
                                <TableCell>{rule.description}</TableCell>
                                <TableCell>
                                    {rule.assigned_user_data ? (
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{rule.assigned_user_data.username}</span>
                                            <span className="text-xs text-muted-foreground">{rule.assigned_user_data.email}</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground italic">Sin asignar</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => { setEditingRule(rule); setIsEditOpen(true) }}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRule.id ? 'Editar Regla' : 'Nueva Regla'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipo de Tarea (Código único)</label>
                            <Input
                                value={editingRule.task_type || ''}
                                onChange={e => setEditingRule(prev => ({ ...prev, task_type: e.target.value }))}
                                disabled={!!editingRule.id} // Cannot change type ID once created to avoid breaking logic
                                placeholder="EJ_OT_APPROVAL"
                            />
                            <p className="text-[10px] text-muted-foreground">Debe coincidir con el código usado en el backend.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descripción</label>
                            <Input
                                value={editingRule.description || ''}
                                onChange={e => setEditingRule(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Aprobación de OTs de Imprenta"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Usuario Responsable</label>
                            {/* Ideally use a proper UserSelector here. Using simple Input for ID or logic for now if component missing */}
                            <UserSelector
                                value={editingRule.assigned_user}
                                onChange={(userId) => setEditingRule(prev => ({ ...prev, assigned_user: userId }))}
                            />
                        </div>
                        <Button className="w-full" onClick={handleSave}>
                            <Save className="mr-2 h-4 w-4" /> Guardar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
