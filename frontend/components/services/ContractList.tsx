"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Eye, PlayCircle, StopCircle, Pencil, Trash2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { ServiceContractDialog } from "@/components/services/ServiceContractDialog"
import { ServiceContractDetailModal } from "@/components/services/ServiceContractDetailModal"

const statusLabels: Record<string, string> = {
    'DRAFT': 'Borrador',
    'ACTIVE': 'Activo',
    'SUSPENDED': 'Suspendido',
    'EXPIRED': 'Vencido',
    'CANCELLED': 'Cancelado'
}

export function ContractList() {
    const [contracts, setContracts] = useState([])
    const [viewingContractId, setViewingContractId] = useState<number | null>(null)

    useEffect(() => {
        fetchContracts()
    }, [])

    const fetchContracts = () => {
        api.get('/services/contracts/').then(res => setContracts(res.data.results || res.data))
    }

    const toggleStatus = async (id: number, currentStatus: string) => {
        try {
            if (currentStatus === 'DRAFT' || currentStatus === 'SUSPENDED') {
                await api.post(`/services/contracts/${id}/activate/`)
                toast.success("Contrato activado")
            } else if (currentStatus === 'ACTIVE') {
                await api.post(`/services/contracts/${id}/suspend/`)
                toast.success("Contrato suspendido")
            }
            fetchContracts()
        } catch (error: any) {
            console.error(error)
            toast.error(error.response?.data?.error || "Error al cambiar estado")
        }
    }

    const handleDelete = async (contract: any) => {
        if (contract.status !== 'DRAFT') {
            toast.error("Solo se pueden eliminar contratos en estado Borrador")
            return
        }

        if ((contract.total_obligations || 0) > 0) {
            toast.error("No se puede eliminar un contrato con obligaciones asociadas")
            return
        }

        if (!confirm(`¿Está seguro de eliminar el contrato "${contract.name}"?`)) return

        try {
            await api.delete(`/services/contracts/${contract.id}/`)
            toast.success("Contrato eliminado correctamente")
            fetchContracts()
        } catch (error: any) {
            console.error("Error deleting contract:", error)
            toast.error(error.response?.data?.error || "No se pudo eliminar el contrato")
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Contratos Registrados</h3>
                <ServiceContractDialog onSuccess={fetchContracts}>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Contrato
                    </Button>
                </ServiceContractDialog>
            </div>

            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead>N° Contrato</TableHead>
                            <TableHead>Servicio</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>Frecuencia</TableHead>
                            <TableHead className="text-right">Monto Base</TableHead>
                            <TableHead>Inicio</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {contracts.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay contratos registrados</TableCell></TableRow>
                        ) : contracts.map((c: any) => (
                            <TableRow key={c.id} className="group hover:bg-muted/20 transition-colors">
                                <TableCell className="font-mono text-xs">{c.contract_number}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{c.name}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">{c.category_data?.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm">{c.supplier_data?.name}</TableCell>
                                <TableCell className="text-sm">{c.recurrence_type}</TableCell>
                                <TableCell className="text-right font-bold tabular-nums">${Number(c.base_amount).toLocaleString()}</TableCell>
                                <TableCell className="text-sm">{c.start_date}</TableCell>
                                <TableCell>
                                    <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'DRAFT' ? 'outline' : 'secondary'} className="text-[10px]">
                                        {statusLabels[c.status] || c.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingContractId(c.id)}>
                                            <Eye className="h-4 w-4" />
                                        </Button>

                                        <ServiceContractDialog initialData={c} onSuccess={fetchContracts}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </ServiceContractDialog>

                                        {(c.status === 'DRAFT' || c.status === 'SUSPENDED') && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => toggleStatus(c.id, c.status)}>
                                                <PlayCircle className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {c.status === 'ACTIVE' && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => toggleStatus(c.id, c.status)}>
                                                <StopCircle className="h-4 w-4" />
                                            </Button>
                                        )}

                                        {c.status === 'DRAFT' && (c.total_obligations || 0) === 0 && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(c)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ServiceContractDetailModal
                contractId={viewingContractId}
                open={viewingContractId !== null}
                onOpenChange={(open) => !open && setViewingContractId(null)}
                onSuccess={fetchContracts}
            />
        </div>
    )
}
