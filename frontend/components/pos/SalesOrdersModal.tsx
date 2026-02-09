"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { LayoutDashboard, ShoppingCart, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { toast } from "sonner"
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns"
import { OrderHubStatus } from "@/components/orders/OrderHubStatus"
import { getHubStatuses } from "@/lib/order-status-utils"
import { DataCell } from "@/components/ui/data-table-cells"
import { translateSalesChannel } from "@/lib/utils"
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

interface SalesOrdersModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

export function SalesOrdersModal({ open, onOpenChange, posSessionId }: SalesOrdersModalProps) {
    const [viewMode, setViewMode] = useState<'orders' | 'notes'>('orders')
    const [orders, setOrders] = useState<SaleOrder[]>([])
    const [notes, setNotes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()

    const filteredOrders = orders.filter(order => {
        if (!dateRange || !dateRange.from) return true

        const orderDate = parseISO(order.date)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)

        return isWithinInterval(orderDate, { start, end })
    })

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
        if (open) {
            if (viewMode === 'orders') {
                fetchOrders()
            } else {
                fetchNotes()
            }
        }
    }, [open, viewMode])

    const noteColumns: ColumnDef<any>[] = [
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Documento" />
            ),
            cell: ({ row }) => (
                <span className="font-mono font-bold text-xs">{row.original.dte_type_display}</span>
            ),
        },
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-muted-foreground text-[10px] sm:text-xs">
                        {row.getValue("number") ? (row.original.dte_type === 'NOTA_CREDITO' ? 'NC-' : 'ND-') + row.getValue("number") : '---'}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cliente" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.original.customer_name || row.original.partner_name}</DataCell.Text>,
        },
        {
            accessorKey: "total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" />
            ),
            cell: ({ row }) => (
                <DataCell.Currency value={row.getValue("total")} />
            ),
        },
        {
            id: "status_hub",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado Hub" />
            ),
            cell: ({ row }) => <NoteHubStatus note={row.original} />,
        },
        {
            id: "status",
            accessorFn: (row) => row.status,
            header: () => null,
            cell: () => null,
            enableHiding: false,
            filterFn: (row, id, value) => value.includes(row.getValue(id))
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => setSelectedInvoiceId(row.original.id)}
                        className="h-8 px-3 w-full"
                    >
                        <LayoutDashboard className="h-4 w-4 mr-1" />
                        Gestionar
                    </Button>
                </div>
            ),
        },
    ]

    const columns: ColumnDef<SaleOrder>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => <DataCell.Code>NV-{row.getValue("number")}</DataCell.Code>,
        },
        {
            accessorKey: "channel_display",
            header: "Sesión POS",
            cell: ({ row }) => {
                const sessionId = row.original.pos_session
                const channelDisplay = translateSalesChannel(row.original.channel_display)

                if (sessionId) {
                    return (
                        <div className="flex items-center gap-2 text-primary hover:underline cursor-pointer group">
                            <Monitor className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="font-medium">Sesión #{sessionId}</span>
                        </div>
                    )
                }

                return (
                    <DataCell.Badge variant="outline" className="text-[10px] whitespace-nowrap">
                        {channelDisplay}
                    </DataCell.Badge>
                )
            },
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cliente" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.getValue("customer_name")}</DataCell.Text>,
        },
        {
            accessorKey: "total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado Hub" />
            ),
            cell: ({ row }) => <OrderHubStatus order={row.original} />,
        },
        // Hidden columns for filtering
        {
            id: "production_status",
            accessorFn: (row) => getHubStatuses(row).production,
            header: () => null,
            cell: () => null,
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "logistics_status",
            accessorFn: (row) => getHubStatuses(row).logistics,
            header: () => null,
            cell: () => null,
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "billing_status",
            accessorFn: (row) => getHubStatuses(row).billing,
            header: () => null,
            cell: () => null,
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "treasury_status",
            accessorFn: (row) => getHubStatuses(row).treasury,
            header: () => null,
            cell: () => null,
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => setSelectedOrderId(row.original.id)}
                        className="h-8 px-3 w-full"
                    >
                        <LayoutDashboard className="h-4 w-4 mr-1" />
                        Gestionar
                    </Button>
                </div>
            ),
        },
    ]

    const filteredNotes = notes.filter(note => {
        if (!dateRange || !dateRange.from) return true
        const noteDate = parseISO(note.date)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)
        return isWithinInterval(noteDate, { start, end })
    })

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent size="full" className="max-w-[95vw] h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5" />
                            {viewMode === 'orders' ? 'Notas de Venta' : 'Notas de Crédito y Débito'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden px-6 pb-6">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-muted-foreground">Cargando datos...</div>
                            </div>
                        ) : (
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
                                />
                            </Tabs>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

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
                }}
                posSessionId={posSessionId}
            />
        </>
    )
}
