"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns" // Assuming date-fns is installed as per other files
import { toast } from "sonner"
import { ArrowLeft, PlayCircle, StopCircle, Trash2, Pencil } from "lucide-react"
import Link from "next/link"
import { ServiceContractDialog } from "@/components/services/ServiceContractDialog"

export default function ServiceContractDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [contract, setContract] = useState<any>(null)
    const [obligations, setObligations] = useState([])
    const [loading, setLoading] = useState(true)

    const id = params.id

    useEffect(() => {
        if (id) {
            fetchData()
        }
    }, [id])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [cRes, oRes] = await Promise.all([
                api.get(`/services/contracts/${id}/`),
                api.get(`/services/contracts/${id}/obligations/`)
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
            await api.post(`/services/contracts/${id}/activate/`)
            toast.success("Contrato activado")
            fetchData()
        } catch (error) {
            toast.error("Error al activar contrato")
        }
    }

    const handleSuspend = async () => {
        try {
            await api.post(`/services/contracts/${id}/suspend/`)
            toast.success("Contrato suspendido")
            fetchData()
        } catch (error) {
            toast.error("Error al suspender contrato")
        }
    }

    if (loading) return <div className="p-6">Cargando...</div>
    if (!contract) return <div className="p-6">Contrato no encontrado</div>

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{contract.name}</h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-mono">{contract.contract_number}</span>
                        <span>•</span>
                        <span>{contract.supplier_data?.name}</span>
                    </div>
                </div>
                <div className="ml-auto flex gap-2">
                    <ServiceContractDialog initialData={contract} onSuccess={fetchData}>
                        <Button variant="outline">
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                        </Button>
                    </ServiceContractDialog>

                    {(contract.status === 'DRAFT' || contract.status === 'SUSPENDED') && (
                        <Button onClick={handleActivate} className="bg-emerald-600 hover:bg-emerald-700">
                            <PlayCircle className="mr-2 h-4 w-4" /> Activar
                        </Button>
                    )}
                    {contract.status === 'ACTIVE' && (
                        <Button onClick={handleSuspend} variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50">
                            <StopCircle className="mr-2 h-4 w-4" /> Suspender
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            <Badge variant={contract.status === 'ACTIVE' ? 'success' : 'outline'}>{contract.status}</Badge>
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

            <Card>
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
                                    <TableCell><Badge variant="outline">{ob.status}</Badge></TableCell>
                                    <TableCell className="text-right font-mono">${Number(ob.amount).toLocaleString()}</TableCell>
                                    <TableCell className="text-xs">
                                        {ob.invoice && <div>Fact: {ob.invoice}</div>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
