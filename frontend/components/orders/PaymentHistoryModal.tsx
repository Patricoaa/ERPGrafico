"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { Landmark, Calendar, User, Hash } from "lucide-react"

interface Payment {
    id: number
    amount: number
    payment_method: string
    payment_method_display: string
    date: string
    reference?: string
    transaction_number?: string
    partner_name?: string
    created_by_name?: string
}

interface PaymentHistoryModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: any
}

export function PaymentHistoryModal({
    open,
    onOpenChange,
    order
}: PaymentHistoryModalProps) {
    const payments = order.related_documents?.payments || order.serialized_payments || []

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Landmark className="h-5 w-5" />
                        Historial de Pagos - Orden {order.number}
                    </DialogTitle>
                </DialogHeader>

                {payments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/30 rounded-lg border-2 border-dashed">
                        <Landmark className="h-12 w-12 mb-4 opacity-20" />
                        <p>No se han registrado pagos para esta orden.</p>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead>Referencia</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map((payment: Payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{new Date(payment.date).toLocaleDateString()}</span>
                                                {payment.created_by_name && (
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <User className="h-3 w-3" /> {payment.created_by_name}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal capitalize">
                                                {payment.payment_method_display || payment.payment_method}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs">{payment.reference || '--'}</span>
                                                {payment.transaction_number && (
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <Hash className="h-3 w-3" /> {payment.transaction_number}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-primary">
                                            {formatCurrency(payment.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <div className="mt-4 p-4 rounded-lg bg-primary/5 flex justify-between items-center border border-primary/10">
                    <span className="text-sm font-medium">Total Pagado:</span>
                    <span className="text-lg font-bold text-primary">
                        {formatCurrency(payments.reduce((acc: number, p: Payment) => acc + parseFloat(p.amount as any), 0))}
                    </span>
                </div>
            </DialogContent>
        </Dialog>
    )
}
