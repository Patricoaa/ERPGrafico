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

interface Budget {
    id: number
    name: string
    start_date: string
    end_date: string
    description?: string
}

export function BudgetsListView() {
    const router = useRouter()
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
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col">
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
                <DataTableColumnHeader column={column} title="Periodo" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                        {row.original.start_date} - {row.original.end_date}
                    </span>
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setBudgetToEdit(row.original)
                            setIsEditorOpen(true)
                        }}
                        className="h-8 text-muted-foreground hover:text-primary"
                    >
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar Montos
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8"
                    >
                        <Link href={`/finances/budgets/${row.original.id}`}>
                            <FileText className="h-4 w-4 mr-2" />
                            Ver Ejecución
                        </Link>
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-6">
            <PageHeader
                title="Presupuestos"
                description="Gestiona y monitorea los presupuestos anuales y su ejecución."
                titleActions={
                    <PageHeaderButton
                        onClick={() => setIsCreateOpen(true)}
                        icon={Plus}
                        circular
                        title="Nuevo Presupuesto"
                    />
                }
            />

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground text-sm animate-pulse">Cargando presupuestos...</p>
                </div>
            ) : budgets.length === 0 ? (
                <div className="bg-white rounded-xl border shadow-sm">
                    <EmptyState
                        icon={Wallet}
                        title="No hay presupuestos"
                        description="Aún no has creado ningún presupuesto anual para monitorear la ejecución financiera."
                        action={
                            <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="gap-2">
                                <Plus className="h-4 w-4" />
                                Crear Primer Presupuesto
                            </Button>
                        }
                    />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={budgets}
                    cardMode
                    globalFilterFields={["name"]}
                    searchPlaceholder="Buscar presupuestos..."
                    useAdvancedFilter={true}
                />
            )}

            {/* Create Modal */}
            <BaseModal
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
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
