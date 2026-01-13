"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ServiceInvoiceDialog } from "@/components/services/ServiceInvoiceDialog"
import { ServicePaymentDialog } from "@/components/services/ServicePaymentDialog"
import { FileText, MoreVertical } from "lucide-react"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { ServiceContractDetailModal } from "@/components/services/ServiceContractDetailModal"
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"

const statusLabels: Record<string, string> = {
    'PENDING': 'Pendiente',
    'INVOICED': 'Facturado',
    'PAID': 'Pagado',
    'OVERDUE': 'Vencido',
    'CANCELLED': 'Cancelado'
}

export default function ServiceObligationsPage() {
    const [obligations, setObligations] = useState([])

    // Dialog states
    const [selectedObligation, setSelectedObligation] = useState<any>(null)
    const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
    const [showPaymentDialog, setShowPaymentDialog] = useState(false)
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

    // Transaction viewing
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)
    const [viewingContractId, setViewingContractId] = useState<number | null>(null)

    useEffect(() => {
        fetchObligations()
    }, [])

    const fetchObligations = () => {
        let url = '/services/obligations/'
        api.get(url).then(res => setObligations(res.data.results || res.data))
    }

    const handleRegisterInvoice = (ob: any) => {
        setSelectedObligation(ob)
        setShowInvoiceDialog(true)
    }

    const getStatusVariant = (status: string, isOverdue: boolean) => {
        if (status === 'PAID') return 'success'
        if (status === 'CANCELLED') return 'destructive'
        if (isOverdue || status === 'OVERDUE') return 'destructive'
        if (status === 'INVOICED') return 'info'
        return 'secondary'
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Obligaciones de Servicio</h1>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Vencimiento</TableHead>
                                <TableHead>Servicio</TableHead>
                                <TableHead>Proveedor</TableHead>
                                <TableHead>Período</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Documentos</TableHead>
                                <TableHead className="text-center">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {obligations.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay obligaciones encontradas</TableCell></TableRow>
                            ) : obligations.map((o: any) => (
                                <TableRow key={o.id}>
                                    <TableCell className="font-medium">
                                        {format(new Date(o.due_date), 'dd MMM yyyy', { locale: es })}
                                        {o.days_until_due < 5 && o.status !== 'PAID' && (
                                            <span className="ml-2 text-xs text-red-500 font-bold">!</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <button
                                            onClick={() => setViewingContractId(o.contract)}
                                            className="text-blue-600 hover:underline text-left"
                                        >
                                            {o.contract_name}
                                        </button>
                                    </TableCell>
                                    <TableCell>{o.supplier_name}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {o.period_start} - {o.period_end}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">${Number(o.amount).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(o.status, o.is_overdue)}>
                                            {statusLabels[o.status] || o.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            {o.invoice && (
                                                <button
                                                    onClick={() => setViewingTransaction({ type: 'invoice', id: o.invoice, view: 'details' })}
                                                    className="text-indigo-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                >
                                                    <span className="font-semibold uppercase text-[8px] text-muted-foreground">Factura</span>
                                                    {o.invoice_number || `ID-${o.invoice}`}
                                                </button>
                                            )}
                                            {o.payment && (
                                                <button
                                                    onClick={() => setViewingTransaction({ type: 'payment', id: o.payment, view: 'details' })}
                                                    className="text-emerald-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                >
                                                    <span className="font-semibold uppercase text-[8px] text-muted-foreground">Pago</span>
                                                    {o.payment_code || `ID-${o.payment}`}
                                                </button>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 items-center">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => setSelectedOrderId(o.id)}
                                                className="h-8 px-3 w-full max-w-[120px]"
                                            >
                                                <MoreVertical className="h-4 w-4 mr-1" />
                                                Gestionar
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <ServiceInvoiceDialog
                open={showInvoiceDialog}
                onOpenChange={setShowInvoiceDialog}
                obligation={selectedObligation}
                onSuccess={fetchObligations}
            />

            <ServicePaymentDialog
                open={showPaymentDialog}
                onOpenChange={setShowPaymentDialog}
                obligation={selectedObligation}
                onSuccess={fetchObligations}
            />

            {viewingTransaction && (
                <TransactionViewModal
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                    view={viewingTransaction.view}
                    open={!!viewingTransaction}
                    onOpenChange={(open) => !open && setViewingTransaction(null)}
                />
            )}

            <ServiceContractDetailModal
                contractId={viewingContractId}
                open={viewingContractId !== null}
                onOpenChange={(open) => !open && setViewingContractId(null)}
                onSuccess={fetchObligations}
            />

            <OrderCommandCenter
                orderId={selectedOrderId}
                type="obligation"
                open={selectedOrderId !== null}
                onOpenChange={(open) => !open && setSelectedOrderId(null)}
                onActionSuccess={fetchObligations}
            />
        </div>
    )
}
