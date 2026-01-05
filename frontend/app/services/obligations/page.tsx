"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ServiceInvoiceDialog } from "@/components/services/ServiceInvoiceDialog"
import { ServicePaymentDialog } from "@/components/services/ServicePaymentDialog"
import { Banknote, FileText } from "lucide-react"

export default function ServiceObligationsPage() {
    const [obligations, setObligations] = useState([])
    const [filter, setFilter] = useState('ALL')

    // Dialog states
    const [selectedObligation, setSelectedObligation] = useState<any>(null)
    const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
    const [showPaymentDialog, setShowPaymentDialog] = useState(false)

    useEffect(() => {
        fetchObligations()
    }, [filter])

    const fetchObligations = () => {
        let url = '/services/obligations/'
        if (filter === 'PENDING') url += '?status=PENDING'
        else if (filter === 'PAID') url += '?status=PAID'
        else if (filter === 'OVERDUE') url += 'overdue/'

        api.get(url).then(res => setObligations(res.data.results || res.data))
    }

    const handleRegisterInvoice = (ob: any) => {
        setSelectedObligation(ob)
        setShowInvoiceDialog(true)
    }

    const handleRegisterPayment = (ob: any) => {
        setSelectedObligation(ob)
        setShowPaymentDialog(true)
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
                <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todas</SelectItem>
                        <SelectItem value="PENDING">Pendientes</SelectItem>
                        <SelectItem value="OVERDUE">Vencidas</SelectItem>
                        <SelectItem value="PAID">Pagadas</SelectItem>
                    </SelectContent>
                </Select>
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
                                        <div className="flex flex-col">
                                            <span>{o.contract_name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{o.supplier_name}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {o.period_start} - {o.period_end}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">${Number(o.amount).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(o.status, o.is_overdue)}>
                                            {o.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 text-xs">
                                            {o.invoice && <span className="text-blue-600 font-semibold">Fact #{o.invoice}</span>}
                                            {o.payment && <span className="text-green-600 font-semibold">Pago #{o.payment}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-center gap-2">
                                            {/* Actions */}
                                            {!o.invoice && o.status !== 'PAID' && o.status !== 'CANCELLED' && (
                                                <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => handleRegisterInvoice(o)} title="Registrar Factura">
                                                    <FileText className="h-4 w-4 mr-1" /> Factura
                                                </Button>
                                            )}

                                            {o.status !== 'PAID' && o.status !== 'CANCELLED' && (
                                                <Button size="sm" variant="default" className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleRegisterPayment(o)} title="Pagar">
                                                    <Banknote className="h-4 w-4 mr-1" /> Pagar
                                                </Button>
                                            )}
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
        </div>
    )
}
