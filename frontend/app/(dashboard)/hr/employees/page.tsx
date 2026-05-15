"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { EmployeeFormModal } from "@/features/hr"
import type { Employee } from "@/types/hr"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useSearchParams, usePathname } from "next/navigation"
import { Pencil } from "lucide-react"
import { ToolbarCreateButton, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEmployees } from "@/features/hr/hooks/useEmployees"
import { employeeSearchDef } from "@/features/hr/searchDef"
import { EntityCard } from "@/components/shared/EntityCard"
import { useViewMode } from "@/hooks/useViewMode"
import { createEntityCardView, createCardLoadingView } from "@/lib/view-helpers"

// Employee schemas and types moved to features/hr/components/EmployeeFormDialog

export default function EmployeesPage() {
    const createAction = <ToolbarCreateButton label="Nuevo Empleado" href="/hr/employees?modal=new" />
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { filters } = useSmartSearch(employeeSearchDef)
    const { employees, isLoading: loading, refetch: fetchEmployees } = useEmployees(filters)
    const { currentView, handleViewChange, viewOptions, isCustomView } = useViewMode('hr.employee')
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
            <DataTable
                columns={columns}
                data={employees}
                isLoading={loading}
                variant="embedded"
                leftAction={<SmartSearchBar searchDef={employeeSearchDef} placeholder="Buscar por nombre o RUT..." className="w-full" />}
                defaultPageSize={20}
                createAction={createAction}
                currentView={currentView}
                onViewChange={handleViewChange}
                viewOptions={viewOptions}
                renderLoadingView={isCustomView ? createCardLoadingView('multi-column', 10) : undefined}
                renderCustomView={isCustomView ? createEntityCardView('hr.employee', {
                    renderCard: (emp: Employee) => (
                        <EntityCard key={emp.id} onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('selected', String(emp.id))
                            router.push(`${pathname}?${params.toString()}`, { scroll: false })
                        }}>
                            <EntityCard.Header
                                title={emp.contact_detail?.name || "Sin nombre"}
                                subtitle={emp.contact_detail?.tax_id || emp.display_id}
                                trailing={
                                    <StatusBadge status={emp.status} label={emp.status_display} size="sm" />
                                }
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Cargo" value={emp.position || '—'} />
                                <EntityCard.Field label="Dpto." value={emp.department || '—'} />
                                <EntityCard.Field label="Previsión" value={`AFP: ${emp.afp_detail?.name || 'N/A'}`} />
                                <EntityCard.Field label="Salud" value={emp.salud_type_display || 'N/A'} />
                            </EntityCard.Body>
                            <EntityCard.Footer className="justify-between items-center border-t bg-muted/10 py-2 px-4">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Sueldo Base</span>
                                <DataCell.Currency value={parseFloat((emp.base_salary as string) || "0")} className="font-bold text-base" />
                            </EntityCard.Footer>
                        </EntityCard>
                    )
                }) : undefined}
            />
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
