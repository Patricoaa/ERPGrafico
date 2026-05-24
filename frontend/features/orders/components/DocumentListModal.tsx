
"use client"

import { BaseModal } from "@/components/shared/BaseModal"
import { formatCurrency } from "@/lib/money"
import { DataTable } from "@/components/shared"
import { StatusBadge } from "@/components/shared"
import { FileText, Package, Truck, ClipboardList, Download, ExternalLink } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { formatEntityDisplay } from "@/lib/entity-registry"
import type { ColumnDef } from "@tanstack/react-table"

interface DocumentItem {
    id: number | string
    number?: string | number
    type_display?: string
    date?: string
    created_at?: string
    total?: number
    status?: string
    status_display?: string
    product_name?: string
    quantity?: number
    unit?: string
    due_date?: string
    reference?: string
    items_count?: number
    pdf_url?: string
}

interface DocumentListModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: 'invoices' | 'receipts' | 'deliveries' | 'work_orders'
    data: DocumentItem[]
    onItemClick?: (type: 'invoice' | 'inventory' | 'work_order', id: number | string) => void
}

const typeIdMap: Record<string, 'invoice' | 'inventory' | 'work_order'> = {
    invoices: 'invoice',
    receipts: 'inventory',
    deliveries: 'inventory',
    work_orders: 'work_order'
}

const config = {
    invoices: {
        title: 'Documentos Tributarios',
        icon: FileText,
    },
    receipts: {
        title: 'Recepciones de Mercadería',
        icon: Package,
    },
    deliveries: {
        title: 'Guías de Despacho',
        icon: Truck,
    },
    work_orders: {
        title: 'Órdenes de Trabajo (OT)',
        icon: ClipboardList,
    }
}

function InvoiceColumns(onItemClick?: (type: 'invoice' | 'inventory' | 'work_order', id: number | string) => void): ColumnDef<DocumentItem>[] {
    return [
        { header: "Folio", accessorKey: "number", cell: ({ row }) => <span className="font-bold">{row.original.number || 'Borrador'}</span> },
        { header: "Tipo", cell: ({ row }) => <span className="text-xs">{row.original.type_display || 'Factura'}</span> },
        { header: "Fecha", cell: ({ row }) => <span className="text-xs">{formatPlainDate(row.original.date || row.original.created_at)}</span> },
        { header: "Monto", cell: ({ row }) => <span className="font-bold text-primary">{formatCurrency(row.original.total)}</span> },
        { header: "Estado", cell: ({ row }) => <StatusBadge status={row.original.status_display || row.original.status || ""} /> },
        { header: "", cell: ({ row }) => <ActionsCell item={row.original} onClick={onItemClick} /> },
    ]
}

function WorkOrderColumns(onItemClick?: (type: 'invoice' | 'inventory' | 'work_order', id: number | string) => void): ColumnDef<DocumentItem>[] {
    return [
        { header: "N° OT", cell: ({ row }) => <span className="font-bold">{formatEntityDisplay('production.workorder', row.original)}</span> },
        { header: "Producto", cell: ({ row }) => <span className="text-xs truncate max-w-[200px]">{row.original.product_name}</span> },
        { header: "Cantidad", cell: ({ row }) => <span className="font-bold">{row.original.quantity} {row.original.unit}</span> },
        { header: "Vencimiento", cell: ({ row }) => <span className="text-xs">{formatPlainDate(row.original.due_date)}</span> },
        { header: "Estado", cell: ({ row }) => <StatusBadge status={row.original.status_display || row.original.status || ""} /> },
        { header: "", cell: ({ row }) => <ActionsCell item={row.original} onClick={onItemClick} /> },
    ]
}

function StockMoveColumns(onItemClick?: (type: 'invoice' | 'inventory' | 'work_order', id: number | string) => void): ColumnDef<DocumentItem>[] {
    return [
        { header: "N°", cell: ({ row }) => <span className="font-bold">{formatEntityDisplay('inventory.stockmove', row.original)}</span> },
        { header: "Folio Guía", cell: ({ row }) => <span className="text-xs font-mono">{row.original.reference || '--'}</span> },
        { header: "Fecha", cell: ({ row }) => <span className="text-xs">{formatPlainDate(row.original.date)}</span> },
        { header: "Ítems", cell: ({ row }) => <span className="text-xs">{row.original.items_count || 0} ítems</span> },
        { header: "Estado", cell: () => <StatusBadge status="COMPLETED" /> },
        { header: "", cell: ({ row }) => <ActionsCell item={row.original} onClick={onItemClick} /> },
    ]
}

function ActionsCell({ item, onClick }: { item: DocumentItem; onClick?: (type: 'invoice' | 'inventory' | 'work_order', id: number | string) => void }) {
    return (
        <div className="flex gap-1">
            {item.pdf_url && (
                <a href={item.pdf_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    <Download className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
                </a>
            )}
            <ExternalLink
                className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation()
                    const targetType = typeIdMap[item.pdf_url ? 'invoices' : 'receipts'] as 'invoice' | 'inventory' | 'work_order'
                    onClick?.(targetType, item.id)
                }}
            />
        </div>
    )
}

export function DocumentListModal({
    open,
    onOpenChange,
    type,
    data = [],
    onItemClick
}: DocumentListModalProps) {
    const current = config[type]
    const Icon = current.icon

    const columns = type === 'invoices'
        ? InvoiceColumns(onItemClick)
        : type === 'work_orders'
            ? WorkOrderColumns(onItemClick)
            : StockMoveColumns(onItemClick)

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={
                <div className="flex items-center gap-2">
                    <Icon className="h-6 w-6 text-primary" />
                    {current.title}
                </div>
            }
        >
            <div className="flex-1 py-4">
                <DataTable
                    columns={columns}
                    data={data}
                    variant="embedded"
                    hidePagination
                    onRowClick={(row) => onItemClick?.(typeIdMap[type], row.id)}
                    emptyState={{
                        icon: Icon,
                        title: "No se han encontrado registros en esta categoría.",
                        description: "Los documentos de este tipo aparecerán aquí cuando estén disponibles.",
                        context: "search",
                    }}
                />
            </div>
        </BaseModal>
    )
}
