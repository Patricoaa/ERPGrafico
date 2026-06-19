"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AbsenceDrawer } from "@/features/hr"
import type { Absence, Employee } from "@/types/hr"
import { ColumnDef } from "@tanstack/react-table"
import { DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { createActionsColumn, DataCell } from '@/components/shared'
import { EntityCard } from "@/components/shared"
import { Pencil, Trash2 } from "lucide-react"
import { ToolbarCreateButton, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { useAbsences, deleteAbsence, getEmployees } from "@/features/hr"
import { absenceSearchDef } from "@/features/hr/searchDef"

interface AbsencesPageClientProps {
    initialAbsences?: Absence[]
}

export default function AbsencesPageClient({ initialAbsences }: AbsencesPageClientProps) {
    const createAction = <ToolbarCreateButton label="Nueva Inasistencia" href="/hr/absences?modal=new" />
    const router = useRouter()
    const searchParams = useSearchParams()
    const { filters, isFiltered } = useSmartSearch(absenceSearchDef)
    const { absences, isLoading: loading, isRefetching, refetch: fetchAbsences } = useAbsences(filters, initialAbsences)
    const [employees, setEmployees] = useState<Employee[]>([])

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

    useEffect(() => {
        getEmployees().then(setEmployees).catch(() => { })
    }, [])

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
            cell: ({ row }) =>
                <DataCell.Status status={row.original.absence_type} label={row.original.absence_type_display} />,
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
        <div className="h-full flex flex-col">

            <AbsenceDrawer
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                absence={editingAbsence}
                employees={employees}
                onSaved={() => { setDialogOpen(false); fetchAbsences() }}
            />

            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="hr.absence"
                    columns={columns}
                    data={absences}
                    isLoading={loading}
                    isRefetching={isRefetching}
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={absenceSearchDef} placeholder="Buscar inasistencias..." className="w-full" />}
                    defaultPageSize={20}
                    onRowClick={(row: Absence) => { setEditingAbsence(row); setDialogOpen(true) }}
                    createAction={createAction}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "users",
                        title: "Aún no hay inasistencias",
                        description: "Las ausencias, permisos y licencias que registres aparecerán aquí.",
                    }}
                    renderCard={(absence: Absence) => (
                        <EntityCard key={absence.id} onClick={() => { setEditingAbsence(absence); setDialogOpen(true) }}>
                            <EntityCard.Header
                                title={absence.employee_name}
                                subtitle={absence.absence_type_display}
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Inicio" value={absence.start_date} />
                                <EntityCard.Field label="Fin" value={absence.end_date} />
                                <EntityCard.Field label="Días" value={String(absence.days)} />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                />
            </div>
        </div>
    )
}
