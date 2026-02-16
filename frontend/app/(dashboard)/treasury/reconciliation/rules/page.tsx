"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { BaseModal } from "@/components/shared/BaseModal"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
    Plus, Settings, Trash2, Edit, Save, X, ArrowLeft, Wand2,
    BarChart3, CheckCircle2, GripVertical
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { SimulationResults } from "./SimulationResults"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface ReconciliationRule {
    id: number
    name: string
    description: string
    treasury_account: { id: number, name: string } | null
    priority: number
    is_active: boolean
    auto_confirm: boolean
    times_applied: number
    success_rate: number
    match_config: any
}

interface Account {
    id: number
    name: string
}

export default function RulesPage() {
    const router = useRouter()
    const [rules, setRules] = useState<ReconciliationRule[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [openDialog, setOpenDialog] = useState(false)
    const [openSimulation, setOpenSimulation] = useState(false)
    const [editingRule, setEditingRule] = useState<Partial<ReconciliationRule>>({})

    useEffect(() => {
        fetchRules()
        fetchAccounts()
    }, [])

    const fetchRules = async () => {
        try {
            const response = await api.get('/treasury/reconciliation-rules/')
            setRules(response.data)
        } catch (error) {
            console.error('Error fetching rules:', error)
            toast.error('Error al cargar reglas')
        } finally {
            setLoading(false)
        }
    }

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/treasury/accounts/')
            setAccounts(response.data)
        } catch (error) {
            console.error('Error fetching accounts:', error)
        }
    }

    const handleSaveRule = async () => {
        try {
            // Transform payload to send ID instead of object
            const payload = {
                ...editingRule,
                treasury_account: editingRule.treasury_account?.id || null
            }

            if (editingRule.id) {
                await api.patch(`/treasury/reconciliation-rules/${editingRule.id}/`, payload)
                toast.success('Regla actualizada')
            } else {
                await api.post('/treasury/reconciliation-rules/', payload)
                toast.success('Regla creada')
            }
            fetchRules()
            setOpenDialog(false)
        } catch (error) {
            console.error('Error saving rule:', error)
            toast.error('Error al guardar regla')
        }
    }

    const confirmDefaultRules = async (accountId: number) => {
        try {
            await api.post('/treasury/reconciliation-rules/create_defaults/', {
                treasury_account_id: accountId
            })
            toast.success('Reglas predeterminadas creadas')
            fetchRules()
        } catch (error) {
            toast.error('Error al crear reglas predeterminadas')
        }
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Reglas de Matching</h2>
                    <p className="text-muted-foreground">Configura la automatización de reconciliación</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => router.push('/treasury/reconciliation')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Button>
                    <Button onClick={() => {
                        setEditingRule({
                            name: '',
                            priority: 10,
                            is_active: true,
                            auto_confirm: false,
                            match_config: { criteria: ['amount_exact'] }
                        })
                        setOpenDialog(true)
                    }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva Regla
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Reglas Activas</CardTitle>
                    <CardDescription>
                        Ordenadas por prioridad de ejecución. Arrastra para reordenar (próximamente).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Cuenta</TableHead>
                                <TableHead>Criterios</TableHead>
                                <TableHead className="text-center">Auto Confirm</TableHead>
                                <TableHead className="text-center">Éxito</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rules.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No hay reglas configuradas.
                                        <div className="mt-4">
                                            <Button variant="outline" onClick={() => confirmDefaultRules(accounts[0]?.id)}>
                                                <Wand2 className="mr-2 h-4 w-4" />
                                                Generar Reglas Sugeridas
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rules.map(rule => (
                                    <TableRow key={rule.id}>
                                        <TableCell>
                                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{rule.name}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                                                {rule.description}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {rule.treasury_account?.name || 'Global'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 flex-wrap">
                                                {rule.match_config.criteria?.map((c: string) => (
                                                    <Badge key={c} variant="secondary" className="text-[10px]">
                                                        {c.replace('_', ' ')}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {rule.auto_confirm ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`font-bold ${rule.success_rate > 80 ? 'text-green-600' :
                                                    rule.success_rate > 50 ? 'text-yellow-600' : 'text-muted-foreground'
                                                    }`}>
                                                    {rule.success_rate}%
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {rule.times_applied} usos
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => {
                                                setEditingRule(rule)
                                                setOpenDialog(true)
                                            }}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-600">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <BaseModal
                open={openDialog}
                onOpenChange={setOpenDialog}
                size="lg"
                title={editingRule.id ? 'Editar Regla' : 'Nueva Regla'}
                description="Define criterios de matching automático"
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
                        <Button onClick={handleSaveRule}>Guardar Regla</Button>
                    </div>
                }
            >
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className={FORM_STYLES.label}>Nombre</Label>
                            <Input
                                value={editingRule.name}
                                onChange={e => setEditingRule({ ...editingRule, name: e.target.value })}
                                className={FORM_STYLES.input}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className={FORM_STYLES.label}>Cuenta</Label>
                            <Select
                                value={editingRule.treasury_account?.id?.toString() || "global"}
                                onValueChange={val => setEditingRule({
                                    ...editingRule,
                                    treasury_account: val === "global" ? null : accounts.find(a => a.id.toString() === val) as any
                                })}
                            >
                                <SelectTrigger className={FORM_STYLES.input}>
                                    <SelectValue placeholder="Global (Todas)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="global">Global (Todas)</SelectItem>
                                    {accounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className={FORM_STYLES.label}>Descripción</Label>
                        <Textarea
                            value={editingRule.description}
                            onChange={e => setEditingRule({ ...editingRule, description: e.target.value })}
                            className={cn("min-h-[80px]", FORM_STYLES.input, "h-auto py-2")}
                        />
                    </div>

                    <div className={cn("flex items-center justify-between", FORM_STYLES.card)}>
                        <div className="space-y-0.5">
                            <Label className={FORM_STYLES.label}>Auto-Confirmar</Label>
                            <p className="text-xs text-muted-foreground">
                                Reconciliar automáticamente si el score es alto
                            </p>
                        </div>
                        <Switch
                            checked={editingRule.auto_confirm}
                            onCheckedChange={checked => setEditingRule({ ...editingRule, auto_confirm: checked })}
                        />
                    </div>

                    {/* Configuración de Criterios Simplificada */}
                    <div className="space-y-2">
                        <Label className={FORM_STYLES.label}>Criterios de Coincidencia</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {['amount_exact', 'transaction_id', 'date_range', 'reference'].map(criteria => (
                                <div key={criteria} className="flex items-center space-x-2 border p-2 rounded">
                                    <Switch
                                        checked={editingRule.match_config?.criteria?.includes(criteria)}
                                        onCheckedChange={checked => {
                                            const current = editingRule.match_config?.criteria || []
                                            const createNew = checked
                                                ? [...current, criteria]
                                                : current.filter((c: string) => c !== criteria)
                                            setEditingRule({
                                                ...editingRule,
                                                match_config: { ...editingRule.match_config, criteria: createNew }
                                            })
                                        }}
                                    />
                                    <span className="text-sm font-medium">
                                        {criteria === 'amount_exact' && 'Monto Exacto'}
                                        {criteria === 'transaction_id' && 'ID Transacción'}
                                        {criteria === 'date_range' && 'Rango Fecha'}
                                        {criteria === 'reference' && 'Referencia'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className={FORM_STYLES.label}>Score Mínimo ({editingRule.match_config?.min_score || 50}%)</Label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={editingRule.match_config?.min_score || 50}
                                onChange={e => setEditingRule({
                                    ...editingRule,
                                    match_config: { ...editingRule.match_config, min_score: parseInt(e.target.value) }
                                })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                            <span className="font-medium text-sm w-12 text-right">
                                {editingRule.match_config?.min_score || 50}%
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-start">
                        <Button variant="secondary" onClick={() => setOpenSimulation(true)}>
                            <Wand2 className="mr-2 h-4 w-4" />
                            Probar Regla
                        </Button>
                    </div>
                </div>
            </BaseModal>

            <BaseModal
                open={openSimulation}
                onOpenChange={setOpenSimulation}
                size="lg"
                title="Simulación de Regla"
                description="Probando regla contra las últimas 50 líneas no reconciliadas."
            >
                <SimulationResults rule={editingRule} />
            </BaseModal>
        </div>
    )
}
