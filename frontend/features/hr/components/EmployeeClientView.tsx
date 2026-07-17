"use client"

import React, { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { EmployeeDrawer } from "@/features/hr"
import type { Employee } from "@/types/hr"
import { type ColumnDef } from "@tanstack/react-table"
import { DataTableView, DataTableColumnHeader, AutoEntityCard } from '@/components/shared'
import { DataCell } from '@/components/shared'
import { employeeActions, type EmployeeActionsCtx } from "@/features/hr/employeeActions"
import { ToolbarCreateButton, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEmployees } from "@/features/hr"
import { employeeUnifiedSearchDef } from "../unifiedSearchDef"
import { employeeFields } from "../employeeFields"

interface EmployeeClientViewProps {
    initialEmployees?: Employee[]
}

export function EmployeeClientView({ initialEmployees }: EmployeeClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nuevo Empleado" href="/hr/employees?modal=new" />
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const search = useUnifiedSearch(employeeUnifiedSearchDef)
    const { employees, isLoading: loading, isRefetching, refetch: fetchEmployees, error } = useEmployees(search.filters, initialEmployees)
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

    const actionsCtx: EmployeeActionsCtx = {
        onEdit: (id) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('selected', String(id))
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
    }

    const columns: ColumnDef<Employee>[] = (() => {
        const [displayIdCol, baseSalaryCol, statusCol] = employeeFields.toColumns()
        return [
            displayIdCol,
            {
                accessorFn: (row) => row.contact_detail?.name || "",
                id: "contact",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Contacto" className="justify-center" />,
                cell: ({ row }) => {
                    const emp = row.original;
                    return (
                        <div>
                            <DataCell.ContactLink contactId={emp.contact}>{emp.contact_detail?.name}</DataCell.ContactLink>
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
                        <DataCell.Text>
                            {emp.afp_detail?.name || 'No disp.'}
                        </DataCell.Text>
                    );
                },
            },
            {
                id: "salud",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Salud" className="justify-center" />,
                cell: ({ row }) => {
                    const emp = row.original;
                    return (
                        <DataCell.Text>
                            {emp.salud_type_display || 'No disp.'}
                        </DataCell.Text>
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
            baseSalaryCol,
            statusCol,
            employeeActions.auto(actionsCtx),
        ]
    })()

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {error && (
                <div className="mx-4 mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    Error al cargar empleados: {error.message}
                </div>
            )}
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="hr.employee"
                    columns={columns}
                    data={employees}
                    isLoading={loading}
                    isRefetching={isRefetching}
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={employeeUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar por nombre o RUT..."
                    />}
                    unifiedSearchConfig={employeeUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    defaultPageSize={20}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "users",
                        title: "Aún no hay empleados",
                        description: "Registra a tu personal para gestionar nóminas, anticipos e inasistencias.",
                    }}
                    renderCard={(emp: Employee) => (
                        <AutoEntityCard
                            key={emp.id}
                            data={emp}
                            fields={employeeFields}
                            entityLabel="hr.employee"
                            title={emp.contact_detail?.name || "Sin nombre"}

                            actions={employeeActions.render(emp, actionsCtx)}
                            defaultAction={employeeActions.defaultAction(actionsCtx)?.(emp) ?? (() => {
                                const params = new URLSearchParams(searchParams.toString())
                                params.set('selected', String(emp.id))
                                router.push(`${pathname}?${params.toString()}`, { scroll: false })
                            })}
                            variant="full"
                        />
                    )}
                    cardSkeleton={{ showFooter: true }}
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
