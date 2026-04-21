"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import api from "@/lib/api"
import { Plus, Pencil, Search, FileText, Calendar, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { BaseModal } from "@/components/shared/BaseModal"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { BudgetEditor } from "@/features/finance/components/BudgetEditor"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"

import { useSearchParams, usePathname } from "next/navigation"

interface Budget {
    id: number
    name: string
    start_date: string
    end_date: string
    description?: string
}

interface BudgetsListViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function BudgetsListView({ externalOpen, onExternalOpenChange, createAction }: BudgetsListViewProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [loading, setLoading] = useState(true)

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newBudget, setNewBudget] = useState({
        name: "",
        start_date: `${new Date().getFullYear()}-01-01`,
        end_date: `${new Date().getFullYear()}-12-31`,
        description: ""
    })

    const handleCloseModal = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`)
    }

    // Synchronize external modal trigger
    useEffect(() => {
        if (externalOpen) {
            setIsCreateOpen(true)
        }
    }, [externalOpen])

    const handleCreateOpenChange = (open: boolean) => {
        setIsCreateOpen(open)
        if (!open) {
            onExternalOpenChange?.(false)
            handleCloseModal()
        }
    }

    // Edit Modal State
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [budgetToEdit, setBudgetToEdit] = useState<Budget | null>(null)

    useEffect(() => {
        loadBudgets()
    }, [])

    const loadBudgets = async () => {
        setLoading(true)
        try {
            const res = await api.get("/accounting/budgets/")
            setBudgets(res.data)
        } catch (err) {
            console.error(err)
            toast.error("Error al cargar presupuestos")
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async () => {
        try {
            await api.post("/accounting/budgets/", newBudget)
            toast.success("Presupuesto creado exitosamente")
            setIsCreateOpen(false)
            handleCreateOpenChange(false) // Ensure clean closure
            loadBudgets()
            setNewBudget({ name: "", start_date: "", end_date: "", description: "" })
        } catch (err) {
            console.error(err)
            toast.error("Error al crear presupuesto")
        }
    }

    const columns: ColumnDef<Budget>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col items-center justify-center w-full">
                    <Link
                        href={`/finances/budgets/${row.original.id}`}
                        className="font-medium hover:underline text-primary flex items-center gap-2"
                    >
                        <Wallet className="h-4 w-4" />
                        {row.getValue("name")}
                    </Link>
                    {row.original.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {row.original.description}
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "start_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Periodo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2 text-muted-foreground w-full">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                        {row.original.start_date} - {row.original.end_date}
                    </span>
                </div>
            ),
        },
        createActionsColumn<Budget>({
            renderActions: (item) => (
                <>
                    <DataCell.Action
                        icon={Pencil}
                        title="Editar Montos"
                        onClick={() => {
                            setBudgetToEdit(item)
                            setIsEditorOpen(true)
                        }}
                    />
                    <DataCell.Action
                        icon={FileText}
                        title="Ver Ejecución"
                        onClick={() => {
                            router.push(`/finances/budgets/${item.id}`)
                        }}
                    />
                </>
            )
        }),
    ]

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={budgets}
                isLoading={loading}
                cardMode
                globalFilterFields={["name"]}
                searchPlaceholder="Buscar presupuestos..."
                useAdvancedFilter={true}
                createAction={createAction}
            />

            {/* Create Modal */}
            <BaseModal
                open={isCreateOpen}
                onOpenChange={handleCreateOpenChange}
                size="md"
                title="Crear Nuevo Presupuesto"
                footer={
                    <Button onClick={handleCreate} className="w-full">Crear Presupuesto Anual</Button>
                }
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nombre o Referencia</Label>
                        <Input
                            value={newBudget.name}
                            onChange={e => setNewBudget({ ...newBudget, name: e.target.value })}
                            placeholder="Ej: Presupuesto Operativo"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Año del Presupuesto</Label>
                        <Input
                            type="number"
                            min={2020}
                            max={2100}
                            defaultValue={new Date().getFullYear()}
                            onChange={e => {
                                const year = e.target.value
                                setNewBudget({
                                    ...newBudget,
                                    name: newBudget.name || `Presupuesto ${year}`,
                                    start_date: `${year}-01-01`,
                                    end_date: `${year}-12-31`
                                })
                            }}
                        />
                        <p className="text-[10px] text-muted-foreground">Los presupuestos se restringen obligatoriamente a un año completo (01 Ene - 31 Dic).</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Input
                            value={newBudget.description}
                            onChange={e => setNewBudget({ ...newBudget, description: e.target.value })}
                        />
                    </div>
                </div>
            </BaseModal>

            {/* Editor Modal */}
            {budgetToEdit && (
                <BudgetEditor
                    open={isEditorOpen}
                    onOpenChange={setIsEditorOpen}
                    budget={budgetToEdit}
                    onSave={() => {
                        loadBudgets() // Optional: refresh if metadata changes, mostly for consistency
                        toast.success("Presupuesto actualizado")
                    }}
                />
            )}
        </div>
    )
}
