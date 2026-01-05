"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlayCircle, StopCircle, Pencil, Trash2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { ServiceContractDialog } from "@/components/services/ServiceContractDialog"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

interface ServiceContractDetailModalProps {
    contractId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

const statusLabels: Record<string, string> = {
    'DRAFT': 'Borrador',
    'ACTIVE': 'Activo',
    'SUSPENDED': 'Suspendido',
    'EXPIRED': 'Vencido',
    'CANCELLED': 'Cancelado'
}

export function ServiceContractDetailModal({ contractId, open, onOpenChange, onSuccess }: ServiceContractDetailModalProps) {
    const [contract, setContract] = useState<any>(null)
    const [obligations, setObligations] = useState([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: 'invoice' | 'payment', id: number | string } | null>(null)

    useEffect(() => {
        if (contractId && open) {
            fetchData()
        }
    }, [contractId, open])

    const fetchData = async () => {
        if (!contractId) return

        try {
            setLoading(true)
            const [cRes, oRes] = await Promise.all([
                api.get(`/services/contracts/${contractId}/`),
                api.get(`/services/contracts/${contractId}/obligations/`)
            ])
            setContract(cRes.data)
            setObligations(oRes.data)
        } catch (error) {
            console.error(error)
            toast.error("Error cargando contrato")
        } finally {
            setLoading(false)
        }
    }

    const handleActivate = async () => {
        try {
            await api.post(`/services/contracts/${contractId}/activate/`)
            toast.success("Contrato activado")
            fetchData()
            if (onSuccess) onSuccess()
        } catch (error) {
            toast.error("Error al activar contrato")
        }
    }

    const handleSuspend = async () => {
        try {
            await api.post(`/services/contracts/${contractId}/suspend/`)
            toast.success("Contrato suspendido")
            fetchData()
            if (onSuccess) onSuccess()
        } catch (error) {
            toast.error("Error al suspender contrato")
        }
    }

    const handleDelete = async () => {
        if (!contract) return

        if (contract.status !== 'DRAFT') {
            toast.error("Solo se pueden eliminar contratos en estado Borrador")
            return
        }

        if (obligations.length > 0) {
            toast.error("No se puede eliminar un contrato con obligaciones asociadas")
            return
        }

        if (!confirm(`¿Está seguro de eliminar el contrato "${contract.name}"?`)) return

        try {
            await api.delete(`/services/contracts/${contractId}/`)
            toast.success("Contrato eliminado correctamente")
            onOpenChange(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error deleting contract:", error)
            toast.error(error.response?.data?.error || "No se pudo eliminar el contrato")
        }
    }

    if (loading || !contract) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6">Cargando...</div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl">{contract.name}</DialogTitle>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <span className="font-mono">{contract.contract_number}</span>
                                <span>•</span>
                                <span>{contract.supplier_data?.name}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <ServiceContractDialog initialData={contract} onSuccess={() => { fetchData(); if (onSuccess) onSuccess(); }}>
                                <Button variant="outline" size="sm">
                                    <Pencil className="mr-2 h-4 w-4" /> Editar
                                </Button>
                            </ServiceContractDialog>

                            {(contract.status === 'DRAFT' || contract.status === 'SUSPENDED') && (
                                <Button onClick={handleActivate} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                                    <PlayCircle className="mr-2 h-4 w-4" /> Activar
                                </Button>
                            )}
                            {contract.status === 'ACTIVE' && (
                                <Button onClick={handleSuspend} size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50">
                                    <StopCircle className="mr-2 h-4 w-4" /> Suspender
                                </Button>
                            )}

                            {contract.status === 'DRAFT' && obligations.length === 0 && (
                                <Button onClick={handleDelete} size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Detalles</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Categoría</p>
                                <p>{contract.category_data?.name}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Estado</p>
                                <Badge variant={contract.status === 'ACTIVE' ? 'success' : 'outline'}>
                                    {statusLabels[contract.status] || contract.status}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Frecuencia de Pago</p>
                                <p>{contract.recurrence_type} (Día {contract.payment_day})</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Monto Base</p>
                                <p className="text-lg font-bold">${Number(contract.base_amount).toLocaleString()}</p>
                                {contract.is_amount_variable && <Badge variant="secondary" className="text-[10px]">Variable</Badge>}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Vigencia</p>
                                <p>{contract.start_date} — {contract.end_date || 'Indefinido'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Renovación</p>
                                <p>{contract.auto_renew ? 'Automática' : 'Manual'}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Cuentas</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Cuenta de Gasto</p>
                                <p className="font-mono text-sm">{contract.expense_account}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Cuenta por Pagar</p>
                                <p className="font-mono text-sm">{contract.payable_account}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="mt-6">
                    <CardHeader><CardTitle>Historial de Obligaciones</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha Vencimiento</TableHead>
                                    <TableHead>Periodo</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead>Documentos</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {obligations.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-4">No hay obligaciones generadas aún</TableCell></TableRow>
                                ) : obligations.map((ob: any) => (
                                    <TableRow key={ob.id}>
                                        <TableCell>{ob.due_date}</TableCell>
                                        <TableCell className="text-xs">{ob.period_start} - {ob.period_end}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{statusLabels[ob.status] || ob.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">${Number(ob.amount).toLocaleString()}</TableCell>
                                        <TableCell className="text-xs">
                                            <div className="flex flex-col gap-1">
                                                {ob.invoice && (
                                                    <button
                                                        onClick={() => setViewingTransaction({ type: 'invoice', id: ob.invoice })}
                                                        className="text-indigo-600 hover:underline text-left text-[10px]"
                                                    >
                                                        {ob.invoice_number || `Fact: ${ob.invoice}`}
                                                    </button>
                                                )}
                                                {ob.payment && (
                                                    <button
                                                        onClick={() => setViewingTransaction({ type: 'payment', id: ob.payment })}
                                                        className="text-emerald-600 hover:underline text-left text-[10px]"
                                                    >
                                                        {ob.payment_code || `Pago: ${ob.payment}`}
                                                    </button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {viewingTransaction && (
                    <TransactionViewModal
                        type={viewingTransaction.type}
                        id={viewingTransaction.id}
                        open={!!viewingTransaction}
                        onOpenChange={(open) => !open && setViewingTransaction(null)}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
