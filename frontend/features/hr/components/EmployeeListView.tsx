"use client"

import React, { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { EmployeeDrawer } from "@/features/hr"
import type { Employee } from "@/types/hr"
import { ColumnDef } from "@tanstack/react-table"
import { DataTableView, EntityCard, StatusBadge } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { createActionsColumn, DataCell } from '@/components/shared'
import { Pencil } from "lucide-react"
import { ToolbarCreateButton, SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from "@/components/shared"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEmployees } from "@/features/hr"
import { employeeSearchDef } from "../searchDef"
import { employeeSegDef } from "../segmentationDef"

interface EmployeeListViewProps {
    initialEmployees?: Employee[]
}

export function EmployeeListView({ initialEmployees }: EmployeeListViewProps) {
    const createAction = <ToolbarCreateButton label="Nuevo Empleado" href="/hr/employees?modal=new" />
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(employeeSearchDef)
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(employeeSegDef)
    const isFiltered = isTextFiltered || isSegFiltered
    const { employees, isLoading: loading, isRefetching, refetch: fetchEmployees } = useEmployees({ ...textFilters, ...segFilters }, initialEmployees)
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Employee>({
        endpoint: '/hr/employees'
    })

    const isNewModalOpen = searchParams.get("modal") === "new"
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
    const activeEmployee = selectedFromUrl || editingEmployee
    const dialogOpen = isNewModalOpen || !!activeEmployee

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
            cell: ({ row }) => <div><DataCell.Code>{row.getValue("display_id")}</DataCell.Code></div>,
        },
        {
            accessorFn: (row) => row.contact_detail?.name || "",
            id: "contact",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Contacto" className="justify-center" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div>
                        <DataCell.ContactLink contactId={emp.contact} className="font-bold">{emp.contact_detail?.name}</DataCell.ContactLink>
                    </div>
                );
            },
        },
        {
            id: "prevision",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Previsión" className="justify-center" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Text>
                            {emp.afp_detail?.name || 'No disp.'}
                        </DataCell.Text>
                    </div>
                );
            },
        },
        {
            id: "salud",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Salud" className="justify-center" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Text>
                            {emp.salud_type_display || 'No disp.'}
                        </DataCell.Text>
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
                <DataCell.Status status={row.getValue("status") as string} label={row.original.status_display} />
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
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="hr.employee"
                    columns={columns}
                    data={employees}
                    isLoading={loading}
                    isRefetching={isRefetching}
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={employeeSearchDef} placeholder="Buscar por nombre o RUT..." className="w-full" />}
                    segmentation={<SegmentationBar def={employeeSegDef} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    defaultPageSize={20}
                    createAction={createAction}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "users",
                        title: "Aún no hay empleados",
                        description: "Registra a tu personal para gestionar nóminas, anticipos e inasistencias.",
                    }}
                    renderCard={(emp: Employee) => (
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
                    )}
                />
            </div>
            <EmployeeDrawer
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                employee={activeEmployee}
                onSaved={() => {
                    setDialogOpen(false)
                    fetchEmployees()
                }}
            />
        </div>
    )
}
