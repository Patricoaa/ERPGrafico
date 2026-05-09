"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { EmployeeFormModal } from "@/features/hr"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { getEmployees } from '@/features/hr/api/hrApi'
import type { Employee } from "@/types/hr"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useSearchParams, usePathname } from "next/navigation"
import { Pencil } from "lucide-react"
import { ToolbarCreateButton } from "@/components/shared"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

// Employee schemas and types moved to features/hr/components/EmployeeFormDialog

export default function EmployeesPage() {
    const createAction = <ToolbarCreateButton label="Nuevo Empleado" href="/hr/employees?modal=new" />
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Employee>({
        endpoint: '/hr/employees'
    })
    
    // Dialog state synchronized with URL or local edit
    const isNewModalOpen = searchParams.get("modal") === "new"
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
    const dialogOpen = isNewModalOpen || !!editingEmployee || !!selectedFromUrl

    useEffect(() => {
        if (selectedFromUrl && (!editingEmployee || editingEmployee.id !== selectedFromUrl.id)) {
            setEditingEmployee(selectedFromUrl)
        }
    }, [selectedFromUrl])

    const setDialogOpen = (open: boolean) => {
        if (!open) {
            setEditingEmployee(null)
            clearSelection()
            if (isNewModalOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.push(`?${params.toString()}`, { scroll: false })
            }
        }
    }

    const fetchEmployees = useCallback(async () => {
        try {
            const data = await getEmployees()
            setEmployees(data)
        } catch {
            toast.error("Error al cargar empleados")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchEmployees() }, [fetchEmployees])

    const columns: ColumnDef<Employee>[] = [
        {
            accessorKey: "display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Code className="font-semibold">{row.getValue("display_id")}</DataCell.Code></div>,
        },
        {
            accessorFn: (row) => row.contact_detail?.name || "",
            id: "nombre",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex flex-col items-center justify-center w-full">
                        <DataCell.Text className="font-bold">{emp.contact_detail?.name}</DataCell.Text>
                        <DataCell.Secondary>{emp.contact_detail?.tax_id}</DataCell.Secondary>
                    </div>
                );
            },
        },
        {
            id: "prevision",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Previsión / Salud" className="justify-center" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex flex-col gap-1 items-center justify-center w-full">
                        <DataCell.Secondary className="text-[9px] uppercase font-bold">
                            AFP: {emp.afp_detail?.name || 'No disp.'}
                        </DataCell.Secondary>
                        <DataCell.Secondary className="text-[9px] uppercase font-bold">
                            Salud: {emp.salud_type_display}
                        </DataCell.Secondary>
                    </div>
                );
            },
        },
        {
            accessorKey: "position",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cargo" className="justify-center" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex flex-col items-center justify-center w-full">
                        <DataCell.Text>{emp.position || '—'}</DataCell.Text>
                        <DataCell.Secondary>{emp.department}</DataCell.Secondary>
                    </div>
                );
            },
        },
        {
            accessorKey: "base_salary",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sueldo Base" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat((row.getValue("base_salary") as string) || "0")} />
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={row.getValue("status") as string} label={row.original.status_display} />
                </div>
            ),
        },
        createActionsColumn<Employee>({
            renderActions: (employee) => (
                <DataCell.Action
                    icon={Pencil}
                    title="Editar Empleado"
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        const params = new URLSearchParams(searchParams.toString())
                        params.set('selected', String(employee.id))
                        router.push(`${pathname}?${params.toString()}`, { scroll: false })
                    }}
                />
            )
        }),
    ]

    return (
        <div className="space-y-4">
            {loading ? (
                <TableSkeleton columns={6} rows={10} />
            ) : (
                <DataTable
                    columns={columns}
                    data={employees}
                    cardMode
                    globalFilterFields={["name", "identity_document", "code", "position", "department"]}
                    searchPlaceholder="Buscar por nombre, RUT, o cargo..."
                    facetedFilters={[
                        {
                            column: "status",
                            title: "Estado",
                            options: [
                                { label: "Activo", value: "ACTIVE" },
                                { label: "Inactivo", value: "INACTIVE" },
                            ],
                        },
                    ]}
                    useAdvancedFilter={true}
                    defaultPageSize={20}
                    createAction={createAction}
                />
            )}
            <EmployeeFormModal
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                employee={editingEmployee}
                onSaved={() => {
                    setDialogOpen(false)
                    fetchEmployees()
                }}
            />
        </div>
    )
}
