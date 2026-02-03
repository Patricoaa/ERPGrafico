"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, translateStatus } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    MessageSquare,
    Monitor as TerminalIcon,
    User as UserIcon,
    FileText
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface CashDifference {
    id: number
    pos_session_audit: number
    pos_session_id: number
    terminal_name: string | null
    amount: string
    reason: string
    reason_display: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    status_display: string
    reported_by_name: string
    reported_at: string
    reporter_notes: string
    approved_by_name: string | null
    approved_at: string | null
    approval_notes: string | null
    journal_entry: number | null
}

export default function CashDifferencesPage() {
    const [differences, setDifferences] = useState<CashDifference[]>([])
    const [loading, setLoading] = useState(true)
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
    const [selectedDiff, setSelectedDiff] = useState<CashDifference | null>(null)
    const [notes, setNotes] = useState("")

    const fetchDifferences = async () => {
        setLoading(true)
        try {
            const res = await api.get('/treasury/cash-differences/')
            setDifferences(res.data.results || res.data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDifferences()
    }, [])

    const handleApprove = async () => {
        if (!selectedDiff) return
        try {
            await api.post(`/treasury/cash-differences/${selectedDiff.id}/approve/`, { notes })
            toast.success("Diferencia aprobada y asiento contable generado")
            setApprovalDialogOpen(false)
            fetchDifferences()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al aprobar")
        }
    }

    const columns: ColumnDef<CashDifference>[] = [
        {
            accessorKey: "reported_at",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha Reporte" />
            ),
            cell: ({ row }) => {
                const date = new Date(row.getValue("reported_at"))
                return (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">
                            {format(date, "dd MMM yyyy", { locale: es })}
                        </span>
                        <span className="text-[10px] text-muted-foreground italic">
                            {format(date, "HH:mm", { locale: es })}
                        </span>
                    </div>
                )
            },
        },
        {
            id: "session",
            header: "Sesión/Terminal",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm font-bold flex items-center gap-1">
                        <TerminalIcon className="h-3 w-3" /> Sesión #{row.original.pos_session_id}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {row.original.terminal_name || 'Terminal Desconocido'}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Monto" />
            ),
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"))
                return (
                    <div className={amount >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {formatCurrency(amount)}
                        <span className="text-[10px] ml-1 opacity-70">
                            ({amount >= 0 ? 'Sobrante' : 'Faltante'})
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "status_display",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const status = row.original.status
                const colorMap: Record<string, string> = {
                    'PENDING': 'warning',
                    'APPROVED': 'success',
                    'REJECTED': 'destructive',
                }
                const iconMap: Record<string, any> = {
                    'PENDING': <Clock className="h-3 w-3 mr-1" />,
                    'APPROVED': <CheckCircle2 className="h-3 w-3 mr-1" />,
                    'REJECTED': <XCircle className="h-3 w-3 mr-1" />,
                }
                return (
                    <Badge variant={colorMap[status] as any} className="flex items-center w-fit">
                        {iconMap[status]}
                        {row.getValue("status_display")}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "reason_display",
            header: "Razón",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{row.getValue("reason_display")}</span>
                </div>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const diff = row.original
                return (
                    <div className="flex items-center gap-2 justify-end">
                        {diff.status === 'PENDING' ? (
                            <Button size="sm" onClick={() => {
                                setSelectedDiff(diff)
                                setNotes("")
                                setApprovalDialogOpen(true)
                            }}>
                                Revisar
                            </Button>
                        ) : (
                            <div className="flex flex-col items-end text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-2 w-2 text-emerald-500" /> Aprobado por {diff.approved_by_name}
                                </span>
                                <span>{diff.approved_at && format(new Date(diff.approved_at), "dd/MM/yy HH:mm")}</span>
                            </div>
                        )}
                    </div>
                )
            },
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Centro de Aprobaciones POS</h2>
                    <p className="text-muted-foreground">
                        Revisión y aprobación de descuadres de caja reportados en el cierre.
                    </p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={differences}
                filterColumn="status_display"
                searchPlaceholder="Filtrar por estado..."
            />

            <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Revisión de Diferencia de Caja</DialogTitle>
                        <DialogDescription>
                            Revise los detalles y apruebe el ajuste contable correspondiente.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedDiff && (
                        <div className="grid gap-6 py-4">
                            <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/30">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Monto de la Diferencia</Label>
                                    <div className={parseFloat(selectedDiff.amount) >= 0 ? "text-xl font-bold text-emerald-700" : "text-xl font-bold text-rose-700"}>
                                        {formatCurrency(selectedDiff.amount)}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Razón Declarada</Label>
                                    <div className="text-sm font-medium">{selectedDiff.reason_display}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Sesión POS</Label>
                                    <div className="text-sm font-medium">#{selectedDiff.pos_session_id} - {selectedDiff.terminal_name}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Reportado por</Label>
                                    <div className="text-sm font-medium flex items-center gap-1">
                                        <UserIcon className="h-3 w-3" /> {selectedDiff.reported_by_name}
                                    </div>
                                </div>
                            </div>

                            {selectedDiff.reporter_notes && (
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" /> Notas del Cajero
                                    </Label>
                                    <div className="p-3 bg-amber-50 border border-amber-100 rounded text-sm italic">
                                        "{selectedDiff.reporter_notes}"
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Notas de Aprobación / Resolución</Label>
                                <Textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Justifique el ajuste contable o registre hallazgos de la auditoría..."
                                    rows={4}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Al aprobar, se generará un asiento contable automático afectando la cuenta de Ganancia/Pérdida por diferencias POS y la cuenta de caja correspondiente.
                                </p>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setApprovalDialogOpen(false)}>Cancelar</Button>
                        <Button variant="outline" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200">
                            Rechazar / Pendiente Invest.
                        </Button>
                        <Button onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700">
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar Ajuste
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
