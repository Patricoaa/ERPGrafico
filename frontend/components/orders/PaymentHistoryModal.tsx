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
import { formatCurrency, formatPlainDate } from "@/lib/utils"
import { Landmark, Calendar, User, Hash, FileText } from "lucide-react"

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
    const payments = order.serialized_payments || order.related_documents?.payments || []

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl overflow-y-auto">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <Landmark className="h-6 w-6 text-primary" />
                        Historial de Pagos y Referencias - {order.number ? ((order.dte_type === 'NOTA_CREDITO' ? 'NC-' : order.dte_type === 'NOTA_DEBITO' ? 'ND-' : '') + order.number) : 'Borrador'}
                    </DialogTitle>
                </DialogHeader>

                {payments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed mt-4">
                        <Landmark className="h-16 w-16 mb-4 opacity-10" />
                        <p className="font-medium text-lg">No se han registrado pagos aún.</p>
                    </div>
                ) : (
                    <div className="mt-4 rounded-xl border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-[11px] font-black uppercase tracking-wider">Fecha</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-wider">Método de Pago</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-wider">Referencia / N° Op</TableHead>
                                    <TableHead className="text-right text-[11px] font-black uppercase tracking-wider">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map((payment: Payment) => (
                                    <TableRow key={payment.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold">{formatPlainDate(payment.date)}</span>
                                                {payment.created_by_name && (
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <User className="h-3 w-3" /> {payment.created_by_name}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-black text-[9px] uppercase border-primary/20 bg-primary/5 text-primary">
                                                {payment.payment_method_display || payment.payment_method}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {payment.reference && (
                                                    <span className="text-xs font-medium flex items-center gap-1">
                                                        <FileText className="h-3 w-3 text-muted-foreground" /> {payment.reference}
                                                    </span>
                                                )}
                                                {payment.transaction_number && (
                                                    <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                                                        <Hash className="h-3 w-3" /> {payment.transaction_number}
                                                    </span>
                                                )}
                                                {!payment.reference && !payment.transaction_number && (
                                                    <span className="text-[10px] text-muted-foreground italic">Sin referencias</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-black text-lg tracking-tighter text-primary">
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
