"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
    LayoutDashboard, Monitor, ArrowRight, Calendar,
    ShoppingCart, Package, FileBadge
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { isWithinInterval, parseISO, startOfDay, endOfDay, format } from "date-fns"
import { OrderHubStatus } from "@/components/orders/OrderHubStatus"
import { getHubStatuses } from "@/lib/order-status-utils"
import { DataCell } from "@/components/ui/data-table-cells"
import { translateSalesChannel, formatPlainDate } from "@/lib/utils"
import { NoteHubStatus } from "@/components/orders/NoteHubStatus"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SaleOrder {
    id: number
    number: string
    customer_name: string
    date: string
    status: string
    total: string
    total_paid: number
    pending_amount: number
    customer: number
    channel_display: string
    delivery_status: 'PENDING' | 'PARTIAL' | 'DELIVERED'
    has_pending_work_orders?: boolean
    related_documents?: {
        invoices: any[]
        notes: any[]
        payments: any[]
        deliveries: any[]
    }
    lines?: any[]
    pos_session_display?: string
    pos_session?: number
}

interface SalesOrdersViewProps {
    posSessionId?: number | null
    onActionSuccess?: () => void
    hideStatusInCards?: boolean
}

export function SalesOrdersView({ posSessionId, onActionSuccess, hideStatusInCards }: SalesOrdersViewProps) {
    const [viewMode, setViewMode] = useState<'orders' | 'notes'>('orders')
    const [orders, setOrders] = useState<SaleOrder[]>([])
    const [notes, setNotes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()

    const fetchOrders = async () => {
        try {
            const response = await api.get('/sales/orders/')
            setOrders(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch sales orders", error)
            toast.error("Error al cargar las notas de venta.")
        } finally {
            setLoading(false)
        }
    }

    const fetchNotes = async () => {
        setLoading(true)
        try {
            const response = await api.get('/billing/invoices/', {
                params: {
                    dte_type__in: 'NOTA_CREDITO,NOTA_DEBITO',
                    sale_order__isnull: false
                }
            })
            const results = response.data.results || response.data
            const salesNotes = results.filter((inv: any) =>
                ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type) && inv.sale_order
            )
            setNotes(salesNotes)
        } catch (error) {
            console.error("Failed to fetch notes", error)
            toast.error("Error al cargar las notas de crédito/débito.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (viewMode === 'orders') {
            fetchOrders()
        } else {
            fetchNotes()
        }
    }, [viewMode])

    const filteredOrders = orders.filter(order => {
        if (!dateRange || !dateRange.from) return true
        const orderDate = parseISO(order.date)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)
        return isWithinInterval(orderDate, { start, end })
    })

    const filteredNotes = notes.filter(note => {
        if (!dateRange || !dateRange.from) return true
        const noteDate = parseISO(note.date)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)
        return isWithinInterval(noteDate, { start, end })
    })

    const columns: ColumnDef<SaleOrder>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
            cell: ({ row }) => <DataCell.Code>NV-{row.getValue("number")}</DataCell.Code>,
        },
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
            cell: ({ row }) => <DataCell.Text>{row.getValue("customer_name")}</DataCell.Text>,
        },
        {
            accessorKey: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado Hub" />,
            cell: ({ row }) => <OrderHubStatus order={row.original} />,
        },
        // Hidden filter columns
        {
            id: "production_status",
            accessorFn: (row) => getHubStatuses(row).production,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "logistics_status",
            accessorFn: (row) => getHubStatuses(row).logistics,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "billing_status",
            accessorFn: (row) => getHubStatuses(row).billing,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "treasury_status",
            accessorFn: (row) => getHubStatuses(row).treasury,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        }
    ]

    const noteColumns: ColumnDef<any>[] = [
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Documento" />,
            cell: ({ row }) => <span className="font-mono font-bold text-xs">{row.original.dte_type_display}</span>,
        },
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
            cell: ({ row }) => (
                <span className="text-muted-foreground text-[10px] sm:text-xs font-mono">
                    {row.getValue("number") ? (row.original.dte_type === 'NOTA_CREDITO' ? 'NC-' : 'ND-') + row.getValue("number") : '---'}
                </span>
            ),
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
            cell: ({ row }) => <DataCell.Text>{row.original.customer_name || row.original.partner_name}</DataCell.Text>,
        },
        {
            accessorKey: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
        },
        {
            id: "status_hub",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado Hub" />,
            cell: ({ row }) => <NoteHubStatus note={row.original} />,
        },
        {
            id: "status",
            accessorFn: (row) => row.status,
            filterFn: (row, id, value) => value.includes(row.getValue(id))
        }
    ]

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {loading ? (
                <div className="flex items-center justify-center flex-1 py-12">
                    <div className="text-muted-foreground">Cargando datos...</div>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden">
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full h-full flex flex-col">
                        <DataTable
                            columns={viewMode === 'orders' ? columns : noteColumns}
                            data={viewMode === 'orders' ? filteredOrders : filteredNotes}
                            filterColumn={viewMode === 'orders' ? "customer_name" : "number"}
                            searchPlaceholder={viewMode === 'orders' ? "Buscar por cliente..." : "Buscar por número..."}
                            facetedFilters={[
                                {
                                    column: "status",
                                    title: "Origen",
                                    options: viewMode === 'orders' ? [
                                        { label: "Borrador", value: "DRAFT" },
                                        { label: "Confirmado", value: "CONFIRMED" },
                                        { label: "Facturado", value: "INVOICED" },
                                        { label: "Pagado", value: "PAID" },
                                        { label: "Anulado", value: "CANCELLED" },
                                    ] : [
                                        { label: "Borrador", value: "DRAFT" },
                                        { label: "Publicado", value: "POSTED" },
                                        { label: "Pagado", value: "PAID" },
                                        { label: "Anulado", value: "CANCELLED" },
                                    ],
                                },
                                ...(viewMode === 'orders' ? [
                                    {
                                        column: "production_status",
                                        title: "Producción",
                                        options: [
                                            { label: "En Proceso", value: "active" },
                                            { label: "Completado", value: "success" },
                                            { label: "Pendiente", value: "neutral" },
                                        ]
                                    },
                                    {
                                        column: "logistics_status",
                                        title: "Logística",
                                        options: [
                                            { label: "En Proceso", value: "active" },
                                            { label: "Completado", value: "success" },
                                            { label: "Pendiente", value: "neutral" },
                                        ]
                                    },
                                    {
                                        column: "billing_status",
                                        title: "Facturación",
                                        options: [
                                            { label: "En Proceso", value: "active" },
                                            { label: "Completado", value: "success" },
                                            { label: "Pendiente", value: "neutral" },
                                        ]
                                    },
                                    {
                                        column: "treasury_status",
                                        title: "Tesorería",
                                        options: [
                                            { label: "En Proceso", value: "active" },
                                            { label: "Completado", value: "success" },
                                            { label: "Pendiente", value: "neutral" },
                                        ]
                                    }
                                ] : [])
                            ]}
                            useAdvancedFilter={true}
                            onReset={() => setDateRange(undefined)}
                            toolbarAction={
                                <div className="flex items-center gap-2">
                                    <DateRangeFilter onRangeChange={setDateRange} label={viewMode === 'orders' ? "Fecha de Venta" : "Fecha de Emisión"} />
                                </div>
                            }
                            rightAction={
                                <TabsList>
                                    <TabsTrigger value="orders">Notas de Venta</TabsTrigger>
                                    <TabsTrigger value="notes">Notas Crédito/Débito</TabsTrigger>
                                </TabsList>
                            }
                            defaultPageSize={20}
                            renderCustomView={(table) => {
                                const rows = table.getRowModel().rows
                                if (rows.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-3xl border-2 border-dashed">
                                            <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                            <p className="text-muted-foreground font-medium">No se encontraron resultados</p>
                                        </div>
                                    )
                                }
                                return (
                                    <div className="grid gap-3 pt-2">
                                        {rows.map((row: any) => {
                                            const item = row.original
                                            return viewMode === 'orders' ? (
                                                <div
                                                    key={item.id}
                                                    className="group flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
                                                    onClick={() => setSelectedOrderId(item.id)}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-primary/5 flex flex-col items-center justify-center border border-primary/10">
                                                            {item.pos_session ? (
                                                                <Monitor className="h-6 w-6 text-primary/60" />
                                                            ) : (
                                                                <ShoppingCart className="h-6 w-6 text-primary/60" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                                    NV-{item.number}
                                                                </span>
                                                                <h4 className="font-bold text-foreground">
                                                                    {item.customer_name}
                                                                </h4>
                                                                {item.pos_session && (
                                                                    <Badge variant="secondary" className="text-[10px] h-4 bg-primary/10 text-primary border-primary/20">
                                                                        POS #{item.pos_session}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3" />
                                                                    {formatPlainDate(item.date)}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <DataCell.Badge variant="outline" className="text-[10px] hover:bg-transparent">
                                                                        {translateSalesChannel(item.channel_display)}
                                                                    </DataCell.Badge>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-6">
                                                        {!hideStatusInCards && (
                                                            <div className="hidden sm:flex flex-col items-end">
                                                                <OrderHubStatus order={item} />
                                                            </div>
                                                        )}

                                                        <div className="text-right min-w-[100px]">
                                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</div>
                                                            <div className="text-sm font-bold text-primary">
                                                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(parseFloat(item.total))}
                                                            </div>
                                                        </div>

                                                        <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                                                            <ArrowRight className="h-5 w-5 text-primary" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    key={item.id}
                                                    className="group flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
                                                    onClick={() => setSelectedInvoiceId(item.id)}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-amber-500/5 flex flex-col items-center justify-center border border-amber-500/10">
                                                            <FileBadge className="h-6 w-6 text-amber-500/60" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                                    {item.dte_type === 'NOTA_CREDITO' ? 'NC-' : 'ND-'}{item.number || '---'}
                                                                </span>
                                                                <h4 className="font-bold text-foreground">
                                                                    {item.customer_name || item.partner_name}
                                                                </h4>
                                                                <Badge variant="outline" className="text-[10px] uppercase">
                                                                    {item.dte_type_display}
                                                                </Badge>
                                                                {item.pos_session && (
                                                                    <Badge variant="secondary" className="text-[10px] h-4 bg-primary/10 text-primary border-primary/20">
                                                                        POS #{item.pos_session}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3" />
                                                                    {formatPlainDate(item.date)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-6">
                                                        {!hideStatusInCards && (
                                                            <div className="hidden sm:flex flex-col items-end">
                                                                <NoteHubStatus note={item} />
                                                            </div>
                                                        )}

                                                        <div className="text-right min-w-[100px]">
                                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</div>
                                                            <div className="text-sm font-bold text-primary">
                                                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(parseFloat(item.total))}
                                                            </div>
                                                        </div>

                                                        <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                                                            <ArrowRight className="h-5 w-5 text-primary" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            }}
                        />
                    </Tabs>
                </div>
            )}

            <OrderCommandCenter
                orderId={selectedOrderId}
                invoiceId={selectedInvoiceId}
                type="sale"
                open={selectedOrderId !== null || selectedInvoiceId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedOrderId(null)
                        setSelectedInvoiceId(null)
                    }
                }}
                onActionSuccess={() => {
                    if (viewMode === 'orders') {
                        fetchOrders()
                    } else {
                        fetchNotes()
                    }
                    if (onActionSuccess) onActionSuccess()
                }}
                posSessionId={posSessionId}
            />
        </div>
    )
}
