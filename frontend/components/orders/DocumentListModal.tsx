"use client"

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
import { Badge } from "@/components/ui/badge"
import { FileText, Package, Truck, ClipboardList, Download, ExternalLink, Hash } from "lucide-react"
import { formatCurrency, formatPlainDate } from "@/lib/utils"

interface DocumentListModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: 'invoices' | 'receipts' | 'deliveries' | 'work_orders'
    data: any[]
    onItemClick?: (type: 'invoice' | 'inventory' | 'work_order', id: number | string) => void
}

export function DocumentListModal({
    open,
    onOpenChange,
    type,
    data = [],
    onItemClick
}: DocumentListModalProps) {
    const config = {
        invoices: {
            title: 'Documentos Tributarios',
            icon: FileText,
            headers: ['Folio', 'Tipo', 'Fecha', 'Monto', 'Estado']
        },
        receipts: {
            title: 'Recepciones de Mercadería',
            icon: Package,
            headers: ['N° Recepción', 'Folio Guía', 'Fecha', 'Ítems', 'Estado']
        },
        deliveries: {
            title: 'Guías de Despacho',
            icon: Truck,
            headers: ['N° Guía', 'Transporte', 'Fecha', 'Ítems', 'Estado']
        },
        work_orders: {
            title: 'Órdenes de Trabajo (OT)',
            icon: ClipboardList,
            headers: ['N° OT', 'Producto', 'Cant.', 'Vencimiento', 'Estado']
        }
    }

    const current = config[type]
    const Icon = current.icon

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <Icon className="h-6 w-6 text-primary" />
                        {current.title}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                            <Icon className="h-16 w-16 mb-4 opacity-10" />
                            <p className="font-medium">No se han encontrado registros en esta categoría.</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        {current.headers.map((h, i) => (
                                            <TableHead key={i} className="text-[11px] font-black uppercase tracking-wider">
                                                {h}
                                            </TableHead>
                                        ))}
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item, idx) => {
                                        const typeIdMap: Record<string, 'invoice' | 'inventory' | 'work_order'> = {
                                            invoices: 'invoice',
                                            receipts: 'inventory',
                                            deliveries: 'inventory',
                                            work_orders: 'work_order'
                                        }
                                        return (
                                            <TableRow
                                                key={idx}
                                                className="hover:bg-muted/30 transition-colors cursor-pointer"
                                                onClick={() => onItemClick?.(typeIdMap[type], item.id)}
                                            >
                                                {/* Specialized columns based on type */}
                                                {type === 'invoices' && (
                                                    <>
                                                        <TableCell className="font-bold">{item.number || 'Borrador'}</TableCell>
                                                        <TableCell className="text-xs">{item.type_display || 'Factura'}</TableCell>
                                                        <TableCell className="text-xs">{formatPlainDate(item.date || item.created_at)}</TableCell>
                                                        <TableCell className="font-bold text-primary">{formatCurrency(item.total)}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={item.status === 'PAID' ? 'success' : 'outline'} className="text-[9px]">
                                                                {item.status_display || item.status}
                                                            </Badge>
                                                        </TableCell>
                                                    </>
                                                )}

                                                {type === 'work_orders' && (
                                                    <>
                                                        <TableCell className="font-bold">OT-{item.number}</TableCell>
                                                        <TableCell className="text-xs truncate max-w-[200px]">{item.product_name}</TableCell>
                                                        <TableCell className="font-bold">{item.quantity} {item.unit}</TableCell>
                                                        <TableCell className="text-xs">{formatPlainDate(item.due_date)}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="text-[9px] uppercase font-bold">
                                                                {item.status_display || item.status}
                                                            </Badge>
                                                        </TableCell>
                                                    </>
                                                )}

                                                {/* Receipts & Deliveries (StockMoves) */}
                                                {(type === 'receipts' || type === 'deliveries') && (
                                                    <>
                                                        <TableCell className="font-bold">SM-{item.id}</TableCell>
                                                        <TableCell className="text-xs font-mono">{item.reference || '--'}</TableCell>
                                                        <TableCell className="text-xs">{formatPlainDate(item.date)}</TableCell>
                                                        <TableCell className="text-xs">{item.items_count || 0} ítems</TableCell>
                                                        <TableCell>
                                                            <Badge variant="success" className="text-[9px]">COMPLETADO</Badge>
                                                        </TableCell>
                                                    </>
                                                )}

                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        {item.pdf_url && (
                                                            <a href={item.pdf_url} target="_blank" rel="noopener noreferrer">
                                                                <Download className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
                                                            </a>
                                                        )}
                                                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
