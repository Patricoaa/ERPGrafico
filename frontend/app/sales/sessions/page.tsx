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
    expected_cash?: number
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

    // Close session form states
    const [actualCash, setActualCash] = useState<string>("0")
    const [closeNotes, setCloseNotes] = useState<string>("")

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

    const handleOpenCloseDialog = (session: POSSession) => {
        setSelectedSession(session)
        setActualCash((session.expected_cash || 0).toString())
        setCloseNotes("")
        setCloseDialogOpen(true)
    }

    const handleCloseSession = async () => {
        if (!selectedSession) return

        setSubmitting(true)
        try {
            const response = await api.post(`/treasury/pos-sessions/${selectedSession.id}/close_session/`, {
                actual_cash: parseFloat(actualCash) || 0,
                notes: closeNotes
            })

            const audit = response.data.audit
            const difference = parseFloat(audit.difference)

            if (difference !== 0) {
                const diffType = difference > 0 ? "sobrante" : "faltante"
                toast.warning(`Caja cerrada con ${diffType} de $${Math.abs(difference).toLocaleString()}`)
            } else {
                toast.success("Caja cerrada correctamente")
            }

            // Immediately fetch summary for Z Report
            const summaryResponse = await api.get(`/treasury/pos-sessions/${selectedSession.id}/summary/`)
            setReportData(summaryResponse.data)
            setReportType("Z")

            setCloseDialogOpen(false)
            setReportDialogOpen(true)

            // Refresh list
            fetchSessions()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al cerrar caja")
        } finally {
            setSubmitting(false)
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
                                    onClick={() => handleOpenCloseDialog(session)}
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

            {/* Session Closing Dialog */}
            <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5" />
                            Cierre de Caja / Arqueo
                        </DialogTitle>
                        <DialogDescription>
                            Cuente el efectivo en caja y registre el monto para la Sesión #{selectedSession?.id}.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSession && (
                        <div className="space-y-4 py-4">
                            <Card className="bg-muted/30">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Resumen del Sistema</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <Banknote className="h-3 w-3" /> Fondo Inicial
                                        </span>
                                        <span className="font-mono font-medium">${(selectedSession.start_amount || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-dashed pt-2">
                                        <span className="text-muted-foreground">Efectivo Esperado (Ventas + Fondo)</span>
                                        <span className="text-primary font-bold font-mono">
                                            ${(selectedSession.expected_cash || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-2">
                                <Label htmlFor="actual-cash">Efectivo Contado ($)</Label>
                                <Input
                                    id="actual-cash"
                                    type="number"
                                    value={actualCash}
                                    onChange={(e) => setActualCash(e.target.value)}
                                    className="text-lg font-bold font-mono"
                                />
                                {selectedSession.expected_cash !== undefined && (
                                    <p className={`text-sm font-medium ${parseFloat(actualCash) > selectedSession.expected_cash
                                        ? 'text-emerald-600'
                                        : parseFloat(actualCash) < selectedSession.expected_cash ? 'text-red-600' : 'text-emerald-600'
                                        }`}>
                                        Diferencia: ${(parseFloat(actualCash) - selectedSession.expected_cash).toLocaleString()}
                                        {parseFloat(actualCash) > selectedSession.expected_cash ? ' (Sobrante)' : parseFloat(actualCash) < selectedSession.expected_cash ? ' (Faltante)' : ' (Cuadrado)'}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="close-notes">Notas (opcional)</Label>
                                <Textarea
                                    id="close-notes"
                                    value={closeNotes}
                                    onChange={(e) => setCloseNotes(e.target.value)}
                                    placeholder="Observaciones del arqueo..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCloseSession} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Procesar Cierre
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
