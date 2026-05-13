"use client"
import { useState, useEffect } from "react"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { FileText, Lock } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

import { POSReport } from "@/features/pos/components/POSReport"
import { SessionCloseModal } from "@/features/pos/components/SessionCloseModal"

interface POSSession {
    id: number
    id_display: string
    user_name: string
    treasury_account: number
    treasury_account_name: string
    opened_at: string
    closed_at: string | null
    status: 'OPEN' | 'CLOSED' | 'CLOSING'
    status_display: string
    start_amount: number
    current_cash?: number
    expected_cash: number
    terminal_name?: string
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
}

interface POSSessionsViewProps {
    hideHeader?: boolean
}

import { usePOSSessions } from "@/features/pos/hooks/usePOSSessions"

export const POSSessionsView = ({ hideHeader = false }: POSSessionsViewProps) => {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { sessions, isLoading, refetch } = usePOSSessions()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<POSSession>({
        endpoint: '/treasury/pos-sessions'
    })

    const [selectedSession, setSelectedSession] = useState<POSSession | null>(null)
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const [reportData, setReportData] = useState<Record<string, unknown> | null>(null)
    const [reportType, setReportType] = useState<"X" | "Z">("X")
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)

    useEffect(() => {
        if (selectedFromUrl) {
            setSelectedSession(selectedFromUrl)
            // Decide what to open. If it's closed, maybe show report Z.
            // If it's open, maybe show report X.
            // For now, let's just open report X by default if selected.
            handleShowReport(selectedFromUrl, selectedFromUrl.status === 'CLOSED' ? 'Z' : 'X')
        }
    }, [selectedFromUrl])

    const handleShowReport = async (session: POSSession, type: "X" | "Z") => {
        try {
            const response = await api.get(`/treasury/pos-sessions/${session.id}/summary/`)
            setReportData(response.data)
            setReportType(type)
            setReportDialogOpen(true)
        } catch (error) {
            console.error("Error fetching report:", error)
            toast.error("Error al generar el reporte")
        }
    }

    const handleCloseSuccess = async () => {
        if (!selectedSession) return
        try {
            const summaryResponse = await api.get(`/treasury/pos-sessions/${selectedSession.id}/summary/`)
            setReportData(summaryResponse.data)
            setReportType("Z")
            setReportDialogOpen(true)
            refetch()
        } catch (error) {
            console.error("Error fetching Z report:", error)
        }
    }

    const columns: ColumnDef<POSSession>[] = [
        {
            accessorKey: "id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="ID" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Code className="font-bold">SES-{row.original.id}</DataCell.Code>
                </div>
            ),
        },
        {
            accessorKey: "user_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cajero" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text>{row.getValue("user_name")}</DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "opened_at",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Apertura" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.getValue("opened_at")} showTime />
                </div>
            ),
        },
        {
            accessorKey: "closed_at",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cierre" className="justify-center" />,
            cell: ({ row }) => {
                const val = row.getValue("closed_at") as string
                return (
                    <div className="flex justify-center w-full">
                        {val ? <DataCell.Date value={val} showTime /> : <span className="text-muted-foreground">-</span>}
                    </div>
                )
            },
        },
        {
            accessorKey: "start_amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fondo Inicial" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={row.getValue("start_amount")} className="text-muted-foreground" />
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={row.original.status} />
                </div>
            ),
        },
        createActionsColumn<POSSession>({
            renderActions: (session) => (
                <>
                    {session.status === 'OPEN' ? (
                        <>
                            <DataCell.Action icon={FileText} title="Reporte X" className="text-info" onClick={() => {
                                const params = new URLSearchParams(searchParams.toString())
                                params.set('selected', String(session.id))
                                router.push(`${pathname}?${params.toString()}`, { scroll: false })
                            }} />
                            <DataCell.Action icon={Lock} title="Cerrar Caja" className="text-destructive" onClick={() => { setSelectedSession(session); setCloseDialogOpen(true); }} />
                        </>
                    ) : (
                        <DataCell.Action icon={FileText} title="Reporte Z" className="text-success" onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('selected', String(session.id))
                            router.push(`${pathname}?${params.toString()}`, { scroll: false })
                        }} />
                    )}
                </>
            )
        })
    ]

    return (
        <div className="flex-1 space-y-4">
            <div className="mt-4">
                <DataTable
                    columns={columns}
                    data={sessions}
                    variant="embedded"
                    isLoading={isLoading}
                    globalFilterFields={["user_name", "status_display", "id"]}
                    searchPlaceholder="Buscar por cajero..."
                    facetedFilters={[{ column: "status", title: "Estado", options: [{ label: "Abierta", value: "OPEN" }, { label: "Cerrada", value: "CLOSED" }, { label: "Cerrando", value: "CLOSING" }] }]}
                    useAdvancedFilter={true}
                    defaultPageSize={10}
                />
            </div>

            {/* Custom Overlay for POS Reports (X and Z) - Consistency with POS */}
            {reportDialogOpen && (
                <div className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden text-foreground">
                    <div className="w-full max-w-sm animate-in zoom-in-95 duration-200">
                        {reportData && (
                            <POSReport
                                data={reportData as any}
                                type={reportType}
                                title={reportType === 'Z' ? 'Informe de Cierre (Z)' : 'Informe Parcial (X)'}
                                onClose={() => {
                                    setReportDialogOpen(false)
                                    clearSelection()
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            {selectedSession && <SessionCloseModal open={closeDialogOpen} onOpenChange={setCloseDialogOpen} session={selectedSession as any} onSuccess={handleCloseSuccess} />}
        </div>
    )
}
