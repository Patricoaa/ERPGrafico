"use client"

import { useState, useEffect, lazy, Suspense } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, CreditCard, Calendar } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useTerminalBatches } from "@/features/treasury"

// Lazy load feature components
const TerminalBatchForm = lazy(() => import("./TerminalBatchForm"))
const MonthlyInvoiceDialog = lazy(() => import("./MonthlyInvoiceDialog"))

interface TerminalBatchesManagementProps {
    showTitle?: boolean
    externalOpenBatch?: boolean
    onExternalOpenBatchChange?: (open: boolean) => void
    externalOpenInvoice?: boolean
    onExternalOpenInvoiceChange?: (open: boolean) => void
}

export function TerminalBatchesManagement({
    showTitle = true,
    externalOpenBatch,
    onExternalOpenBatchChange,
    externalOpenInvoice,
    onExternalOpenInvoiceChange
}: TerminalBatchesManagementProps) {
    const { batches, refetch } = useTerminalBatches()
    const [openCreate, setOpenCreate] = useState(false)
    const [openInvoice, setOpenInvoice] = useState(false)

    useEffect(() => {
        if (externalOpenBatch) {
            setOpenCreate(true)
        }
    }, [externalOpenBatch])

    useEffect(() => {
        if (externalOpenInvoice) {
            setOpenInvoice(true)
        }
    }, [externalOpenInvoice])

    const columns = [
        {
            accessorKey: "sales_date",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Fecha Ventas" />,
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                        {format(new Date(row.original.sales_date), "dd/MM/yyyy")}
                    </span>
                </div>
            )
        },
        {
            accessorKey: "payment_method_name",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Terminal" />,
            cell: ({ row }: any) => (
                <div className="flex flex-col">
                    <span className="font-bold flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                        {row.original.payment_method_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {row.original.supplier_name}
                    </span>
                </div>
            )
        },
        {
            accessorKey: "net_amount",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Depósito Neto" />,
            cell: ({ row }: any) => {
                const amount = parseFloat(row.getValue("net_amount"))
                return (
                    <div className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                        {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)}
                    </div>
                )
            }
        },
        {
            accessorKey: "commission_total",
            header: "Comisión (Total)",
            cell: ({ row }: any) => {
                const amount = parseFloat(row.original.commission_total)
                return (
                    <span className="text-destructive font-medium">
                        -{new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)}
                    </span>
                )
            }
        },
        {
            accessorKey: "status",
            header: "Estado",
            cell: ({ row }: any) => {
                const status = row.original.status
                const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
                    'PENDING': 'secondary',
                    'SETTLED': 'default',
                    'RECONCILED': 'outline',
                    'INVOICED': 'outline'
                }
                const labels: Record<string, string> = {
                    'PENDING': 'Pendiente',
                    'SETTLED': 'Liquidado',
                    'RECONCILED': 'Conciliado',
                    'INVOICED': 'Facturado'
                }

                const className = status === 'SETTLED'
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200"
                    : status === 'RECONCILED'
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : ""

                return <Badge variant={variants[status] || "outline"} className={className}>{labels[status] || status}</Badge>
            }
        },
        {
            id: "actions",
            cell: ({ row }: any) => (
                <div className="flex justify-end gap-2">
                </div>
            )
        }
    ]

    return (
        <div className="space-y-4">
            {showTitle && (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Lotes de Terminales</h2>
                        <p className="text-muted-foreground">Registre liquidaciones y comisiones de terminales de cobro.</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" onClick={() => setOpenInvoice(true)}>
                            <FileText className="mr-2 h-4 w-4" /> Generar Factura Mensual
                        </Button>
                        <Button onClick={() => setOpenCreate(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Registrar Liquidación
                        </Button>
                    </div>
                </div>
            )}

            {!showTitle && (
                <div className="flex justify-end gap-2 mb-2 hidden">
                    <Button variant="outline" size="sm" onClick={() => setOpenInvoice(true)}>
                        <FileText className="mr-2 h-4 w-4" /> Factura Mensual
                    </Button>
                    <Button size="sm" onClick={() => setOpenCreate(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Registrar Liquidación
                    </Button>
                </div>
            )}

            <div className="bg-white/50 backdrop-blur-sm rounded-xl border shadow-sm p-1">
                <DataTable
                    columns={columns}
                    data={batches}
                    searchPlaceholder="Buscar por terminal o referencia..."
                    filterColumn="payment_method_name"
                />
            </div>

            <Suspense fallback={null}>
                <TerminalBatchDialog
                    open={openCreate}
                    onOpenChange={(open: boolean) => {
                        setOpenCreate(open)
                        if (!open) onExternalOpenBatchChange?.(false)
                    }}
                    onSuccess={() => {
                        setOpenCreate(false)
                        onExternalOpenBatchChange?.(false)
                        refetch()
                    }}
                />
            </Suspense>

            <Suspense fallback={null}>
                <MonthlyInvoiceDialog
                    open={openInvoice}
                    onOpenChange={(open: boolean) => {
                        setOpenInvoice(open)
                        if (!open) onExternalOpenInvoiceChange?.(false)
                    }}
                />
            </Suspense>
        </div>
    )
}

function TerminalBatchDialog({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px]">
                <DialogHeader>
                    <DialogTitle>Registrar Liquidación de Terminal</DialogTitle>
                    <DialogDescription>
                        Ingrese los datos de la liquidación diaria informada por el proveedor del terminal.
                    </DialogDescription>
                </DialogHeader>
                <TerminalBatchForm onSuccess={onSuccess} onCancel={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    )
}

export default TerminalBatchesManagement
