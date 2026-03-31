import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Banknote, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPlainDate, translatePaymentMethod, formatCurrency } from "@/lib/utils"

export const PaymentHistorySection = React.memo(({ data, currentType, navigateTo, handleDeletePayment }: { data: any, currentType: string, navigateTo: any, handleDeletePayment: any }) => {
    const payments = data?.serialized_payments || data?.payments_detail || [];
    if (payments.length === 0) return null;

    return (
        <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-emerald-600">
                <Banknote className="h-5 w-5" />
                Historial de Pagos
            </h3>
            <div className="border rounded-2xl overflow-hidden bg-background shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/10">
                        <TableRow className="hover:bg-transparent tracking-widest text-[10px] font-black uppercase">
                            <TableHead className="h-10">Fecha</TableHead>
                            <TableHead className="h-10">Método / Referencia</TableHead>
                            <TableHead className="text-right h-10 w-[140px]">Monto</TableHead>
                            <TableHead className="text-right h-10 w-[80px]">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((pay: any) => (
                            <TableRow key={pay.id} className="hover:bg-muted/10 transition-colors">
                                <TableCell className="text-xs font-semibold">{formatPlainDate(pay.date || pay.created_at)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold uppercase">{translatePaymentMethod(pay.payment_method || pay.journal_name)}</span>
                                        <span className="text-[9px] font-mono text-muted-foreground">{pay.transaction_number || pay.reference || '-'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-black text-sm text-emerald-600">
                                    {formatCurrency(pay.amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-lg hover:bg-blue-50" onClick={() => navigateTo('payment', pay.id)}>
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
})

PaymentHistorySection.displayName = "PaymentHistorySection"
