"use client"

import { useState, useEffect } from "react"
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
import {
    Loader2,
    ShoppingCart,
    Package,
    Factory,
    User
} from "lucide-react"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from "@/components/ui/data-table-cells"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"

interface ContactInsightsDialogProps {
    contactId: number | null
    contactName: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface ContactInsights {
    contact: any
    sales: {
        count: number
        invoices: any[]
    }
    purchases: {
        count: number
        orders: any[]
    }
    work_orders: {
        count: number
        orders: any[]
    }
}

export function ContactInsightsDialog({ contactId, contactName, open, onOpenChange }: ContactInsightsDialogProps) {
    const [data, setData] = useState<ContactInsights | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open && contactId) {
            fetchInsights()
        }
    }, [open, contactId])

    const fetchInsights = async () => {
        setLoading(true)
        try {
            const res = await api.get(`/contacts/contacts/${contactId}/insights/`)
            setData(res.data)
        } catch (error) {
            console.error("Error fetching contact insights:", error)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl">Insights del Contacto</DialogTitle>
                                {contactName && (
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {contactName}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground animate-pulse">Analizando datos del contacto...</p>
                    </div>
                ) : !data ? (
                    <div className="flex-1 flex items-center justify-center py-20">
                        <p className="text-muted-foreground">Error al cargar datos.</p>
                    </div>
                ) : (
                    <Tabs defaultValue="summary" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 border-b">
                            <TabsList className="bg-transparent h-12 w-full justify-start gap-6 rounded-none p-0">
                                <TabsTrigger value="summary" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2">Resumen</TabsTrigger>
                                <TabsTrigger value="sales" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-primary/80">
                                    <ShoppingCart className="h-4 w-4 mr-2" />
                                    Ventas
                                </TabsTrigger>
                                <TabsTrigger value="purchases" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-primary/80">
                                    <Package className="h-4 w-4 mr-2" />
                                    Compras
                                </TabsTrigger>
                                <TabsTrigger value="work_orders" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-primary/80">
                                    <Factory className="h-4 w-4 mr-2" />
                                    Órdenes de Trabajo
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-auto p-6">
                            {/* SUMMARY TAB */}
                            <TabsContent value="summary" className="mt-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="bg-emerald-50/30 border-emerald-100">
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Ventas</p>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-2xl font-black text-emerald-900">{data.sales.count}</p>
                                                <span className="text-xs text-emerald-600">docs</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-blue-50/30 border-blue-100">
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Compras</p>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-2xl font-black text-blue-900">{data.purchases.count}</p>
                                                <span className="text-xs text-blue-600">docs</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-amber-50/30 border-amber-100">
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Órdenes de Trabajo</p>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-2xl font-black text-amber-900">{data.work_orders.count}</p>
                                                <span className="text-xs text-amber-600">OTs</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            {/* SALES TAB */}
                            <TabsContent value="sales" className="mt-0">
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Documento</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead>Total</TableHead>
                                                <TableHead>Estado</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.sales.invoices.map((invoice) => (
                                                <TableRow key={invoice.id}>
                                                    <TableCell className="text-xs">
                                                        {format(new Date(invoice.date), "dd/MM/yyyy", { locale: es })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="font-bold">
                                                            {invoice.display_id}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {invoice.invoice_type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <DataCell.Currency value={invoice.total} className="text-left font-bold" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={invoice.status === 'PAID' ? 'success' : 'outline'} className="text-[10px]">
                                                            {invoice.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {data.sales.invoices.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                                                        Sin ventas registradas
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            {/* PURCHASES TAB */}
                            <TabsContent value="purchases" className="mt-0">
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Documento</TableHead>
                                                <TableHead>Total</TableHead>
                                                <TableHead>Estado</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.purchases.orders.map((order) => (
                                                <TableRow key={order.id}>
                                                    <TableCell className="text-xs">
                                                        {format(new Date(order.date), "dd/MM/yyyy", { locale: es })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="font-bold">
                                                            {order.display_id}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <DataCell.Currency value={order.total} className="text-left font-bold" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={order.status === 'COMPLETED' ? 'success' : 'outline'} className="text-[10px]">
                                                            {order.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {data.purchases.orders.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                                                        Sin compras registradas
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            {/* WORK ORDERS TAB */}
                            <TabsContent value="work_orders" className="mt-0">
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>N° OT</TableHead>
                                                <TableHead>Descripción</TableHead>
                                                <TableHead>Estado</TableHead>
                                                <TableHead>Progreso</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.work_orders.orders.map((order) => (
                                                <TableRow key={order.id}>
                                                    <TableCell className="text-xs">
                                                        {format(new Date(order.created_at), "dd/MM/yyyy", { locale: es })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="indigo" className="font-bold">
                                                            {order.display_id}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={order.description}>
                                                        {order.description}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={order.status === 'FINISHED' ? 'success' : 'outline'} className="text-[10px]">
                                                            {order.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary transition-all"
                                                                    style={{ width: `${order.production_progress || 0}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{order.production_progress || 0}%</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {data.work_orders.orders.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                                                        Sin órdenes de trabajo registradas
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    )
}
