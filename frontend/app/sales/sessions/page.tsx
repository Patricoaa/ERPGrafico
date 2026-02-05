"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { FileText, Store, Lock, Calculator, Banknote, CreditCard, ArrowRightLeft, Loader2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { POSReport } from "@/components/pos/POSReport"
import { SessionCloseModal } from "@/components/pos/SessionCloseModal"

interface POSSession {
    id: number
    id_display: string
    user_name: string
    treasury_account_name: string
    opened_at: string
    closed_at: string | null
    status: 'OPEN' | 'CLOSED' | 'CLOSING'
    status_display: string
    start_amount: number
    current_cash?: number
    expected_cash: number  // Required for SessionCloseModal
    // Additional fields for SessionCloseModal
    terminal_name?: string
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
}

export default function POSSessionsPage() {
    const router = useRouter()
    const [sessions, setSessions] = useState<POSSession[]>([])
    const [loading, setLoading] = useState(true)

    // Action states
    const [selectedSession, setSelectedSession] = useState<POSSession | null>(null)
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const [reportData, setReportData] = useState<any>(null)
    const [reportType, setReportType] = useState<"X" | "Z">("X")
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Close dialog state - modal manages its own form state

    useEffect(() => {
        fetchSessions()
    }, [])

    const fetchSessions = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/pos-sessions/')
            setSessions(response.data)
        } catch (error) {
            console.error('Error fetching sessions:', error)
            toast.error("Error al cargar las sesiones")
        } finally {
            setLoading(false)
        }
    }

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



    const handleCloseSuccess = async (audit: any) => {
        // Fetch summary for Z Report
        if (!selectedSession) return

        try {
            const summaryResponse = await api.get(`/treasury/pos-sessions/${selectedSession.id}/summary/`)
            setReportData(summaryResponse.data)
            setReportType("Z")
            setReportDialogOpen(true)

            // Refresh list
            fetchSessions()
        } catch (error) {
            console.error("Error fetching Z report:", error)
        }
    }

    const columns: ColumnDef<POSSession>[] = [
        {
            accessorKey: "id",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="ID" />
            ),
            cell: ({ row }) => <DataCell.Code className="font-bold">SES-{row.original.id}</DataCell.Code>,
        },
        {
            accessorKey: "user_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cajero" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.getValue("user_name")}</DataCell.Text>,
        },
        {
            accessorKey: "opened_at",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Apertura" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("opened_at")} showTime />,
        },
        {
            accessorKey: "closed_at",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cierre" />
            ),
            cell: ({ row }) => {
                const val = row.getValue("closed_at") as string
                return val ? <DataCell.Date value={val} showTime /> : <span className="text-muted-foreground">-</span>
            },
        },
        {
            accessorKey: "start_amount",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fondo Inicial" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("start_amount")} className="text-muted-foreground" />,
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const state = row.getValue("status") as string
                const variant = state === 'OPEN' ? 'success' : state === 'CLOSED' ? 'secondary' : 'warning'
                return (
                    <DataCell.Badge variant={variant}>
                        {row.original.status_display}
                    </DataCell.Badge>
                )
            },
        },
        {
            id: "actions",
            header: "Acción",
            cell: ({ row }) => {
                const session = row.original
                return (
                    <div className="flex justify-center gap-2">
                        {session.status === 'OPEN' ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleShowReport(session, "X")}
                                    title="Reporte X"
                                    className="h-8 w-8 p-0"
                                >
                                    <FileText className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedSession(session)
                                        setCloseDialogOpen(true)
                                    }}
                                    title="Cerrar Caja"
                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                >
                                    <Lock className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShowReport(session, "Z")}
                                title="Reporte Z"
                                className="h-8 w-8 p-0"
                            >
                                <FileText className="h-4 w-4 text-emerald-500" />
                            </Button>
                        )}
                    </div>
                )
            },
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground/90">Sesiones Punto de Venta</h2>
                    <p className="text-muted-foreground">
                        Historial de aperturas y cierres de caja.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => router.push('/sales/pos')} className="bg-primary hover:bg-primary/90">
                        <Store className="mr-2 h-4 w-4" />
                        Ir al POS
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="mt-4">
                    <DataTable
                        columns={columns}
                        data={sessions}
                        filterColumn="user_name"
                        searchPlaceholder="Buscar por cajero..."
                        facetedFilters={[
                            {
                                column: "status",
                                title: "Estado",
                                options: [
                                    { label: "Abierta", value: "OPEN" },
                                    { label: "Cerrada", value: "CLOSED" },
                                    { label: "Cerrando", value: "CLOSING" },
                                ]
                            }
                        ]}
                        useAdvancedFilter={true}
                        defaultPageSize={10}
                    />
                </div>
            )}

            {/* POS Report Dialog (X/Z) */}
            <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="sr-only">
                        <DialogTitle>
                            {reportType === 'Z' ? 'Informe de Cierre (Z)' : 'Informe Parcial (X)'}
                        </DialogTitle>
                        <DialogDescription>
                            Detalles del informe de sesión
                        </DialogDescription>
                    </DialogHeader>
                    {reportData && (
                        <POSReport
                            data={reportData}
                            type={reportType}
                            title={reportType === 'Z' ? 'Informe de Cierre (Z)' : 'Informe Parcial (X)'}
                        />
                    )}
                    <DialogFooter className="print:hidden">
                        <Button onClick={() => setReportDialogOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Session Close Modal - Using shared component */}
            {selectedSession && (
                <SessionCloseModal
                    open={closeDialogOpen}
                    onOpenChange={setCloseDialogOpen}
                    session={selectedSession}
                    onSuccess={handleCloseSuccess}
                />
            )}
        </div>
    )
}
