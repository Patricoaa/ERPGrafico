"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { BaseModal } from "@/components/shared/BaseModal"
import { LabeledInput, LabeledSelect } from "@/components/shared"
import { Plus, Trash2, Edit, Wand2, CheckCircle2 } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { useRulesQuery, useAccountsQuery } from "../hooks/useReconciliationQueries"
import { useSaveRuleMutation, useCreateDefaultRulesMutation } from "../hooks/useReconciliationMutations"
import { Card } from "@/components/ui/card"
import type { ReconciliationRule, TreasuryAccount as Account } from "../types"
import { SimulationResults } from "./SimulationResults"
import { cn } from "@/lib/utils"

type RuleRow = ReconciliationRule & { account_name: string }

export function ReconciliationRules({ externalOpen, createAction }: { externalOpen?: boolean; createAction?: React.ReactNode }) {
    const router = useRouter()
    
    const { data: rules = [], isLoading: isLoadingRules } = useRulesQuery()
    const { data: accounts = [], isLoading: isLoadingAccounts } = useAccountsQuery()
    
    const saveRuleMutation = useSaveRuleMutation()
    const createDefaultRulesMutation = useCreateDefaultRulesMutation()

    const [openDialog, setOpenDialog] = useState(false)
    const [openSimulation, setOpenSimulation] = useState(false)
    const [editingRule, setEditingRule] = useState<Partial<ReconciliationRule>>({})

    const loading = isLoadingRules || isLoadingAccounts

    useEffect(() => {
        if (externalOpen) {
            requestAnimationFrame(() => {
                setEditingRule({ name: '', priority: 10, is_active: true, auto_confirm: false, match_config: { criteria: ['amount_exact'] } })
                setOpenDialog(true)
            })
        }
    }, [externalOpen])

    const handleDialogChange = (open: boolean) => {
        setOpenDialog(open)
        if (!open) router.replace('/treasury/reconciliation?tab=rules')
    }

    const handleSaveRule = async () => {
        try {
            await saveRuleMutation.mutateAsync(editingRule)
            handleDialogChange(false)
        } catch (error) {
            // Error handled in mutation
        }
    }

    const handleCreateDefaults = async (accountId: number) => {
        await createDefaultRulesMutation.mutateAsync(accountId)
    }

    // Flatten treasury_account.name for easy filtering/sorting
    const tableData = useMemo(() =>
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
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center justify-center w-full">
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
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cuenta" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <Badge variant="outline" className="font-mono text-xs">{row.getValue("account_name")}</Badge>
                </div>
            ),
            filterFn: "arrIncludes",
        },
        {
            id: "criterios",
            accessorKey: "match_config",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Criterios" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex gap-1 flex-wrap justify-center w-full">
                    {row.original.match_config.criteria?.map((c) => (
                        <Badge key={c} variant="secondary" className="text-xs lowercase">
                            {c.replace('_', ' ')}
                        </Badge>
                    ))}
                </div>
            ),
            enableSorting: false,
        },
        {
            accessorKey: "auto_confirm",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Auto" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    {row.original.auto_confirm
                        ? <CheckCircle2 className="h-4 w-4 text-success" />
                        : <span className="text-muted-foreground/30">-</span>
                    }
                </div>
            ),
            enableSorting: false,
        },
        {
            accessorKey: "success_rate",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Éxito" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center justify-center w-full">
                    <span className={cn(
                        "font-bold text-sm",
                        row.original.success_rate > 80 ? 'text-success' :
                        row.original.success_rate > 50 ? 'text-warning' : 'text-muted-foreground'
                    )}>
                        {row.original.success_rate}%
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono"> {/* intentional: badge density */} {row.original.times_applied} usos</span>
                </div>
            ),
        },
        createActionsColumn<RuleRow>({
            renderActions: (item) => (
                <>
                    <DataCell.Action
                        icon={Edit}
                        title="Editar"
                        onClick={() => { setEditingRule(item); setOpenDialog(true) }}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive"
                    />
                </>
            )
        })
    ], [])

    const finalCreateAction = (
        <div className="flex items-center gap-2">
            {!loading && rules.length === 0 && (
                <Button 
                    variant="outline" 
                    onClick={() => handleCreateDefaults(accounts[0]?.id)}
                    className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest"
                >
                    <Wand2 className="mr-2 h-3.5 w-3.5" />
                    Generar Reglas Sugeridas
                </Button>
            )}
            {createAction}
        </div>
    )

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
                createAction={finalCreateAction}
            />

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
                        <LabeledInput
                            label="Nombre"
                            value={editingRule.name || ""}
                            onChange={e => setEditingRule({ ...editingRule, name: e.target.value })}
                        />
                        <LabeledSelect
                            label="Cuenta"
                            value={editingRule.treasury_account?.id?.toString() || "global"}
                            onChange={val => setEditingRule({
                                ...editingRule,
                                treasury_account: val === "global" ? null : accounts.find(a => a.id.toString() === val) as Account
                            })}
                            options={[
                                { value: "global", label: "Global (Todas)" },
                                ...accounts.map(acc => ({ value: acc.id.toString(), label: acc.name }))
                            ]}
                        />
                    </div>

                    <div className="space-y-2">
                        <LabeledInput
                            as="textarea"
                            label="Descripción"
                            value={editingRule.description || ""}
                            onChange={e => setEditingRule({ ...editingRule, description: e.target.value })}
                            className="min-h-[80px]"
                        />
                    </div>

                    <Card variant="dashed" className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-xs font-bold uppercase text-muted-foreground">Auto-Confirmar</p>
                            <p className="text-xs text-muted-foreground">Reconciliar automáticamente si el score es alto</p>
                        </div>
                        <Switch
                            checked={editingRule.auto_confirm}
                            onCheckedChange={checked => setEditingRule({ ...editingRule, auto_confirm: checked })}
                        />
                    </Card>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Criterios de Coincidencia</p>
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
                                                    criteria: checked ? [...current, criteria] : current.filter((c) => c !== criteria)
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
                        <p className="text-xs font-bold uppercase text-muted-foreground">Score Mínimo ({editingRule.match_config?.min_score || 50}%)</p>
                        <div className="flex items-center gap-4">
                            <input
                                type="range" min="0" max="100" step="5"
                                value={editingRule.match_config?.min_score || 50}
                                onChange={e => setEditingRule({
                                    ...editingRule,
                                    match_config: { ...editingRule.match_config, min_score: parseInt(e.target.value) }
                                })}
                                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
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
