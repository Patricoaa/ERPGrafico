
"use client"

import { BaseModal, DataCell, DataTable } from '@/components/shared'
import { FileText, Package, Truck, ClipboardList, ExternalLink } from "lucide-react"
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
        { header: "Folio", accessorKey: "number", cell: ({ row }) => <DataCell.Code>{row.original.number || 'Borrador'}</DataCell.Code> },
        { header: "Tipo", cell: ({ row }) => <DataCell.Text>{row.original.type_display || 'Factura'}</DataCell.Text> },
        { header: "Fecha", cell: ({ row }) => <DataCell.Date value={row.original.date || row.original.created_at} /> },
        { header: "Monto", cell: ({ row }) => <DataCell.Currency value={row.original.total} /> },
        { header: "Estado", cell: ({ row }) => <DataCell.Status status={row.original.status_display || row.original.status || ""} /> },
        { header: "", cell: ({ row }) => <ActionsCell item={row.original} onClick={onItemClick} /> },
    ]
}

function WorkOrderColumns(onItemClick?: (type: 'invoice' | 'inventory' | 'work_order', id: number | string) => void): ColumnDef<DocumentItem>[] {
    return [
        { header: "N° OT", cell: ({ row }) => <DataCell.Code>{formatEntityDisplay('production.workorder', row.original)}</DataCell.Code> },
        { header: "Producto", cell: ({ row }) => <DataCell.Text>{row.original.product_name}</DataCell.Text> },
        { header: "Cantidad", cell: ({ row }) => <DataCell.Number value={row.original.quantity!} suffix={row.original.unit} /> },
        { header: "Vencimiento", cell: ({ row }) => <DataCell.Date value={row.original.due_date} /> },
        { header: "Estado", cell: ({ row }) => <DataCell.Status status={row.original.status_display || row.original.status || ""} /> },
        { header: "", cell: ({ row }) => <ActionsCell item={row.original} onClick={onItemClick} /> },
    ]
}

function StockMoveColumns(onItemClick?: (type: 'invoice' | 'inventory' | 'work_order', id: number | string) => void): ColumnDef<DocumentItem>[] {
    return [
        { header: "N°", cell: ({ row }) => <DataCell.Code>{formatEntityDisplay('inventory.stockmove', row.original)}</DataCell.Code> },
        { header: "Folio Guía", cell: ({ row }) => <DataCell.Code>{row.original.reference || '--'}</DataCell.Code> },
        { header: "Fecha", cell: ({ row }) => <DataCell.Date value={row.original.date} /> },
        { header: "Ítems", cell: ({ row }) => <DataCell.Number value={row.original.items_count || 0} suffix="ítems" /> },
        { header: "Estado", cell: () => <DataCell.Status status="COMPLETED" /> },
        { header: "", cell: ({ row }) => <ActionsCell item={row.original} onClick={onItemClick} /> },
    ]
}

function ActionsCell({ item, onClick }: { item: DocumentItem; onClick?: (type: 'invoice' | 'inventory' | 'work_order', id: number | string) => void }) {
    return (
        <div className="flex gap-1">
            {item.pdf_url && (
                <DataCell.Action
                    action="download"
                    onClick={() => window.open(item.pdf_url!, '_blank', 'noopener,noreferrer')}
                />
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
