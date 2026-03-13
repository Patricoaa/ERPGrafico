"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { BaseModal } from "@/components/shared/BaseModal"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Edit, Wand2, CheckCircle2 } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import api from "@/lib/api"
import { toast } from "sonner"
import { SimulationResults } from "./rules/SimulationResults"
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

interface ReconciliationRulesProps {
    externalOpen?: boolean
}



// ── Flattened row type (treasury_account → account_name string) ─────────────
type RuleRow = Omit<ReconciliationRule, "treasury_account"> & { account_name: string }

export function ReconciliationRules({ externalOpen }: ReconciliationRulesProps) {
    const router = useRouter()
    const [rules, setRules] = useState<ReconciliationRule[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [openDialog, setOpenDialog] = useState(false)
    const [openSimulation, setOpenSimulation] = useState(false)
    const [editingRule, setEditingRule] = useState<Partial<ReconciliationRule>>({})

    useEffect(() => {
        if (externalOpen) {
            setEditingRule({ name: '', priority: 10, is_active: true, auto_confirm: false, match_config: { criteria: ['amount_exact'] } })
            setOpenDialog(true)
        }
    }, [externalOpen])

    useEffect(() => { fetchRules(); fetchAccounts() }, [])

    const handleDialogChange = (open: boolean) => {
        setOpenDialog(open)
        if (!open) router.replace('/treasury/reconciliation?tab=rules')
    }

    const fetchRules = async () => {
        try {
            const res = await api.get('/treasury/reconciliation-rules/')
            setRules(res.data)
        } catch { toast.error('Error al cargar reglas') }
        finally { setLoading(false) }
    }

    const fetchAccounts = async () => {
        try { const res = await api.get('/treasury/accounts/'); setAccounts(res.data) }
        catch { console.error('Error fetching accounts') }
    }

    const handleSaveRule = async () => {
        try {
            const payload = { ...editingRule, treasury_account: editingRule.treasury_account?.id || null }
            if (editingRule.id) {
                await api.patch(`/treasury/reconciliation-rules/${editingRule.id}/`, payload)
                toast.success('Regla actualizada')
            } else {
                await api.post('/treasury/reconciliation-rules/', payload)
                toast.success('Regla creada')
            }
            fetchRules(); handleDialogChange(false)
        } catch { toast.error('Error al guardar regla') }
    }

    const confirmDefaultRules = async (accountId: number) => {
        try {
            await api.post('/treasury/reconciliation-rules/create_defaults/', { treasury_account_id: accountId })
            toast.success('Reglas predeterminadas creadas'); fetchRules()
        } catch { toast.error('Error al crear reglas predeterminadas') }
    }

    // Flatten treasury_account.name for easy filtering/sorting
    const tableData = useMemo<RuleRow[]>(() =>
        rules.map(r => ({ ...r, account_name: r.treasury_account?.name || 'Global' })),
        [rules]
    )

    const accountFilterOptions = useMemo(() => {
        const names = Array.from(new Set(tableData.map(r => r.account_name)))
        return names.map(n => ({ label: n, value: n }))
    }, [tableData])

    const columns = useMemo<ColumnDef<RuleRow>[]>(() => [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center">
                    <span className="font-medium text-sm">{row.original.name}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[280px] text-center">
                        {row.original.description}
                    </span>
                </div>
            ),
            enableGlobalFilter: true,
        },
        {
            accessorKey: "account_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cuenta" />,
            cell: ({ row }) => <Badge variant="outline">{row.getValue("account_name")}</Badge>,
            filterFn: "arrIncludes",
        },
        {
            id: "criterios",
            accessorKey: "match_config",
            header: () => <span className="text-sm font-medium text-muted-foreground">Criterios</span>,
            cell: ({ row }) => (
                <div className="flex gap-1 flex-wrap justify-center">
                    {row.original.match_config.criteria?.map((c: string) => (
                        <Badge key={c} variant="secondary" className="text-[10px]">
                            {c.replace('_', ' ')}
                        </Badge>
                    ))}
                </div>
            ),
            enableSorting: false,
        },
        {
            accessorKey: "auto_confirm",
            header: () => <span className="text-sm font-medium text-muted-foreground">Auto Confirm</span>,
            cell: ({ row }) => row.original.auto_confirm
                ? <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                : <span className="text-muted-foreground">-</span>,
            enableSorting: false,
        },
        {
            accessorKey: "success_rate",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Éxito" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center">
                    <span className={cn(
                        "font-bold text-sm",
                        row.original.success_rate > 80 ? 'text-green-600' :
                        row.original.success_rate > 50 ? 'text-yellow-600' : 'text-muted-foreground'
                    )}>
                        {row.original.success_rate}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">{row.original.times_applied} usos</span>
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <span className="text-sm font-medium text-muted-foreground">Acciones</span>,
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingRule(row.original); setOpenDialog(true) }}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
            enableSorting: false,
        },
    ], [])

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={tableData}
                cardMode
                isLoading={loading}
                skeletonRows={5}
                globalFilterFields={["name"]}
                searchPlaceholder="Buscar regla..."
                useAdvancedFilter
                facetedFilters={[
                    { column: "account_name", title: "Cuenta", options: accountFilterOptions }
                ]}
                defaultPageSize={10}
                pageSizeOptions={[5, 10, 20, 50]}
            />

            {/* Empty state when no rules configured */}
            {!loading && rules.length === 0 && (
                <div className="text-center py-4">
                    <Button variant="outline" onClick={() => confirmDefaultRules(accounts[0]?.id)}>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Generar Reglas Sugeridas
                    </Button>
                </div>
            )}

            {/* Edit / Create Modal */}
            <BaseModal
                open={openDialog}
                onOpenChange={handleDialogChange}
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
                            <Input value={editingRule.name} onChange={e => setEditingRule({ ...editingRule, name: e.target.value })} className={FORM_STYLES.input} />
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
                            <p className="text-xs text-muted-foreground">Reconciliar automáticamente si el score es alto</p>
                        </div>
                        <Switch
                            checked={editingRule.auto_confirm}
                            onCheckedChange={checked => setEditingRule({ ...editingRule, auto_confirm: checked })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className={FORM_STYLES.label}>Criterios de Coincidencia</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {['amount_exact', 'transaction_id', 'date_range', 'reference'].map(criteria => (
                                <div key={criteria} className="flex items-center space-x-2 border p-2 rounded">
                                    <Switch
                                        checked={editingRule.match_config?.criteria?.includes(criteria)}
                                        onCheckedChange={checked => {
                                            const current = editingRule.match_config?.criteria || []
                                            setEditingRule({
                                                ...editingRule,
                                                match_config: {
                                                    ...editingRule.match_config,
                                                    criteria: checked ? [...current, criteria] : current.filter((c: string) => c !== criteria)
                                                }
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
                                type="range" min="0" max="100" step="5"
                                value={editingRule.match_config?.min_score || 50}
                                onChange={e => setEditingRule({
                                    ...editingRule,
                                    match_config: { ...editingRule.match_config, min_score: parseInt(e.target.value) }
                                })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                            <span className="font-medium text-sm w-12 text-right">{editingRule.match_config?.min_score || 50}%</span>
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
