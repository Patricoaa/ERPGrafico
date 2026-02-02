"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, FileText, CheckCircle2, ChevronDown, ChevronUp, CreditCard, Landmark } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function CardBillingDashboard() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any[]>([])
    const [year, setYear] = useState(new Date().getFullYear().toString())
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString())
    const [expandedProvider, setExpandedProvider] = useState<number | null>(null)
    const [processingInvoice, setProcessingInvoice] = useState<number | null>(null)

    const fetchDashboard = async () => {
        try {
            setLoading(true)
            const response = await api.get("/treasury/card-billing/dashboard/", {
                params: { year, month }
            })
            setData(response.data)
        } catch (error) {
            console.error("Error fetching dashboard:", error)
            toast.error("Error al cargar datos del dashboard")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDashboard()
    }, [year, month])

    const handleGenerateInvoice = async (providerId: number) => {
        try {
            setProcessingInvoice(providerId)
            const response = await api.post("/treasury/card-billing/generate-invoice/", {
                provider_id: providerId,
                year,
                month
            })
            toast.success(response.data.message || "Factura generada con éxito")
            fetchDashboard()
        } catch (error: any) {
            console.error("Error generating invoice:", error)
            toast.error(error.response?.data?.error || "Error al generar factura")
        } finally {
            setProcessingInvoice(null)
        }
    }

    const months = [
        { value: "1", label: "Enero" },
        { value: "2", label: "Febrero" },
        { value: "3", label: "Marzo" },
        { value: "4", label: "Abril" },
        { value: "5", label: "Mayo" },
        { value: "6", label: "Junio" },
        { value: "7", label: "Julio" },
        { value: "8", label: "Agosto" },
        { value: "9", label: "Septiembre" },
        { value: "10", label: "Octubre" },
        { value: "11", label: "Noviembre" },
        { value: "12", label: "Diciembre" },
    ]

    const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg text-primary">
                        <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold">Periodo de Facturación</h3>
                        <p className="text-xs text-muted-foreground">Seleccione el mes para ver los abonos y comisiones</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="w-[140px] bg-background">
                            <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="w-[100px] bg-background">
                            <SelectValue placeholder="Año" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => (
                                <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                    <p className="text-sm text-muted-foreground animate-pulse">Cargando datos de facturación...</p>
                </div>
            ) : data.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                        <CreditCard className="h-12 w-12 text-muted-foreground/20 mb-4" />
                        <h3 className="text-lg font-medium">No se encontraron proveedores activos</h3>
                        <p className="text-sm text-muted-foreground max-w-xs">Asegúrese de configurar proveedores de tarjetas en la sección de Tesorería.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {data.map((provider) => (
                        <Card key={provider.provider_id} className={cn(
                            "overflow-hidden transition-all duration-300 border-l-4",
                            provider.invoice_id ? "border-l-emerald-500" : "border-l-amber-500"
                        )}>
                            <CardHeader className="bg-muted/10">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "p-2 rounded-xl text-white shadow-lg",
                                            provider.invoice_id ? "bg-emerald-500" : "bg-amber-500"
                                        )}>
                                            <Landmark className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">{provider.provider_name}</CardTitle>
                                            <CardDescription className="flex items-center gap-2">
                                                Factura: <span className="font-bold text-foreground">{provider.supplier_name}</span>
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Total Comisión Bruta</p>
                                            <p className="text-2xl font-black text-foreground">
                                                ${(provider.total_commission + provider.total_vat).toLocaleString('es-CL')}
                                            </p>
                                        </div>
                                        {provider.invoice_id ? (
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-emerald-200">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" /> FACTURADA
                                                </Badge>
                                                <span className="text-[10px] font-bold text-muted-foreground">Ref: {provider.invoice_number || 'Borrador'}</span>
                                            </div>
                                        ) : (
                                            <Button
                                                onClick={() => handleGenerateInvoice(provider.provider_id)}
                                                disabled={processingInvoice === provider.provider_id || provider.settlements_count === 0}
                                                className="bg-amber-600 hover:bg-amber-700 shadow-md h-10 px-6 font-bold"
                                            >
                                                {processingInvoice === provider.provider_id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <FileText className="h-4 w-4 mr-2" />
                                                )}
                                                Generar Factura Mensual
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border-y border-border/50">
                                    <div className="p-4 text-center">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Abonos Netos</p>
                                        <p className="text-lg font-bold">${provider.total_net.toLocaleString('es-CL')}</p>
                                    </div>
                                    <div className="p-4 text-center">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Comisión (Neto)</p>
                                        <p className="text-lg font-bold">${provider.total_commission.toLocaleString('es-CL')}</p>
                                    </div>
                                    <div className="p-4 text-center">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">IVA Retenido</p>
                                        <p className="text-lg font-bold">${provider.total_vat.toLocaleString('es-CL')}</p>
                                    </div>
                                    <div className="p-4 text-center">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Bruto Ventas</p>
                                        <p className="text-lg font-bold">${provider.total_gross.toLocaleString('es-CL')}</p>
                                    </div>
                                </div>

                                <div className="p-4 bg-muted/5">
                                    <div
                                        className="flex items-center justify-between cursor-pointer group"
                                        onClick={() => setExpandedProvider(expandedProvider === provider.provider_id ? null : provider.provider_id)}
                                    >
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            Detalle de Liquidaciones Diarias
                                            <Badge variant="outline" className="text-[10px] h-5">{provider.settlements_count} días</Badge>
                                        </h4>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                                            {expandedProvider === provider.provider_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </div>

                                    {expandedProvider === provider.provider_id && (
                                        <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                                            {provider.details.length === 0 ? (
                                                <div className="text-center py-10 italic text-muted-foreground text-sm">
                                                    No se han registrado conciliaciones con comisión este mes.
                                                </div>
                                            ) : (
                                                <div className="rounded-xl border border-border/50 overflow-hidden bg-background">
                                                    <Table>
                                                        <TableHeader className="bg-muted/30">
                                                            <TableRow>
                                                                <TableHead className="text-[10px] font-black uppercase">Fecha</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase text-right">Monto Neto</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase text-right">Comisión</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase text-right">IVA</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase text-right">Monto Bruto</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase">Estado</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {provider.details.map((settlement: any) => (
                                                                <TableRow key={settlement.id} className="hover:bg-muted/20">
                                                                    <TableCell className="font-medium text-xs">
                                                                        {format(new Date(settlement.settlement_date + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-bold text-xs">${parseFloat(settlement.total_net).toLocaleString('es-CL')}</TableCell>
                                                                    <TableCell className="text-right text-xs text-muted-foreground">${parseFloat(settlement.total_commission).toLocaleString('es-CL')}</TableCell>
                                                                    <TableCell className="text-right text-xs text-muted-foreground">${parseFloat(settlement.total_vat).toLocaleString('es-CL')}</TableCell>
                                                                    <TableCell className="text-right font-black text-xs text-primary">${parseFloat(settlement.total_gross).toLocaleString('es-CL')}</TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline" className="text-[9px] h-4 py-0 font-bold border-emerald-200 text-emerald-600 bg-emerald-50">CONCILIADO</Badge>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
