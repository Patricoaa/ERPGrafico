"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AbsenceFormModal } from "@/features/hr"
import { getAbsences, deleteAbsence, getEmployees } from '@/features/hr/api/hrApi'
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import type { Absence, Employee } from "@/types/hr"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pencil, Trash2 } from "lucide-react"

import { ToolbarCreateButton } from "@/components/shared"

// Absence schemas and types moved to features/hr/components/AbsenceFormDialog

export default function AbsencesPage() {
    const createAction = <ToolbarCreateButton label="Nueva Inasistencia" href="/hr/absences?modal=new" />
    const router = useRouter()
    const searchParams = useSearchParams()
    const [absences, setAbsences] = useState<Absence[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    
    // Dialog state synchronized with URL or local edit
    const isNewModalOpen = searchParams.get("modal") === "new"
    const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null)
    const dialogOpen = isNewModalOpen || !!editingAbsence

    const setDialogOpen = (open: boolean) => {
        if (!open) {
            setEditingAbsence(null)
            if (isNewModalOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.push(`?${params.toString()}`, { scroll: false })
            }
        }
    }

    const fetchAbsences = useCallback(async () => {
        try {
            const data = await getAbsences()
            setAbsences(data)
        } catch {
            toast.error("Error al cargar inasistencias")
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchAll = useCallback(async () => {
        await Promise.all([
            fetchAbsences(),
            getEmployees().then(setEmployees)
        ])
    }, [fetchAbsences])

    useEffect(() => { fetchAll() }, [fetchAll])

    const handleDelete = async (id: number) => {
        if (!confirm("¿Eliminar esta inasistencia?")) return
        try {
            await deleteAbsence(id)
            toast.success("Inasistencia eliminada")
            fetchAbsences()
        } catch {
            toast.error("Error al eliminar inasistencia")
        }
    }

    const columns: ColumnDef<Absence>[] = [
        {
            accessorKey: "employee_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Empleado" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Text className="font-bold">{row.getValue("employee_name")}</DataCell.Text></div>,
        },
        {
            accessorKey: "absence_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={row.original.absence_type} label={row.original.absence_type_display} />
                </div>
            ),
        },
        {
            accessorKey: "start_date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Inicio" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Date value={row.getValue("start_date")} /></div>,
        },
        {
            accessorKey: "end_date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fin" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Date value={row.getValue("end_date")} /></div>,
        },
        {
            accessorKey: "days",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Días" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Text className="font-mono">{row.getValue("days")}</DataCell.Text></div>,
        },
        createActionsColumn<Absence>({
            renderActions: (absence) => (
                <>
                    <DataCell.Action
                        icon={Pencil}
                        title="Editar"
                        onClick={() => { setEditingAbsence(absence); setDialogOpen(true) }}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(absence.id)}
                    />
                </>
            )
        }),
    ]

    return (
        <div className="space-y-4">

            <AbsenceFormModal
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                absence={editingAbsence}
                employees={employees}
                onSaved={() => { setDialogOpen(false); fetchAll() }}
            />

            {loading ? (
                <TableSkeleton columns={5} rows={8} />
            ) : (
                <DataTable
                    columns={columns}
                    data={absences}
                    cardMode
                    globalFilterFields={["employee_name", "absence_type_display"]}
                    searchPlaceholder="Buscar por empleado o tipo..."
                    facetedFilters={[
                        {
                            column: "absence_type_display",
                            title: "Tipo",
                            options: [
                                { label: "Ausentismo", value: "Ausentismo Injustificado" },
                                { label: "Licencia", value: "Licencia Médica" },
                                { label: "Permiso Sin Goce", value: "Permiso sin Goce de Sueldo" },
                                { label: "Ausencia de Horas", value: "Ausencia de Horas" },
                            ],
                        },
                    ]}
                    useAdvancedFilter={true}
                    defaultPageSize={20}
                    onRowClick={(row: Absence) => { setEditingAbsence(row); setDialogOpen(true) }}
                    createAction={createAction}
                />
            )}
        </div>
    )
}
