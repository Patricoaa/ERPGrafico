"use client"

import React, { useRef } from "react"
import { Chip, Drawer, SkeletonShell, StatusBadge, DataTable } from "@/components/shared"
import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useDrawerIdentity } from "@/features/_shared"
import { Button } from "@/components/ui/button"
import { Printer, Check, XCircle } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { formatCurrency } from "@/lib/money"
import { PrintableLayout } from "@/features/_shared"
import { useInventoryDocument, useInventoryDocumentMutations } from "../hooks/useInventoryDocuments"
import type { InventoryDocumentDetail } from "../types"
import { formDrawerWidth } from "@/lib/form-widths"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"

interface InventoryDocumentDrawerProps {
    documentId?: number | null
    id?: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function InventoryDocumentDrawer({ documentId, id, open, onOpenChange, onSuccess }: InventoryDocumentDrawerProps) {
    const entityId = documentId ?? id ?? null
    const { data: document, isLoading } = useInventoryDocument(entityId)
    const { confirmDocument, isConfirming, annulDocument, isAnnulling } = useInventoryDocumentMutations(entityId ?? undefined)

    const identity = useDrawerIdentity('inventory.inventorydocument', 'view', document as Record<string, unknown> | undefined, {
        overrideTitle: document ? `${document.document_type_display} #${document.id}` : "Documento de Inventario",
    })
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const handleConfirm = async () => {
        if (!entityId) return
        try {
            await confirmDocument(entityId)
            toast.success("Documento confirmado con éxito y stock actualizado.")
            onSuccess?.()
        } catch (error) {
            showApiError(error, "Error al confirmar documento")
        }
    }

    const handleAnnul = async () => {
        if (!entityId) return
        try {
            await annulDocument(entityId)
            toast.success("Documento anulado con éxito.")
            onSuccess?.()
        } catch (error) {
            showApiError(error, "Error al anular documento")
        }
    }

    const columns = useMemo<ColumnDef<InventoryDocumentDetail>[]>(() => [
        {
            id: "product",
            header: "Producto",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-foreground">{row.original.product_name}</span>
                    {row.original.product_internal_code && (
                        <span className="text-[10px] text-muted-foreground font-mono">{row.original.product_internal_code}</span>
                    )}
                </div>
            )
        },
        {
            id: "quantity",
            header: "Cantidad",
            cell: ({ row }) => `${row.original.quantity} ${row.original.uom_name || ''}`,
            meta: { align: "right" }
        },
        {
            id: "cost",
            header: "Costo Unit.",
            cell: ({ row }) => formatCurrency(Number(row.original.unit_cost || 0)),
            meta: { align: "right" }
        },
        {
            id: "warehouse",
            header: "Almacén",
            cell: ({ row }) => {
                const src = row.original.source_warehouse_name
                const dest = row.original.warehouse_name
                if (src) {
                    return `${src} ➔ ${dest}`
                }
                return dest
            }
        }
    ], [])

    return (
        <>
            <PrintableLayout
                ref={printRef}
                title="Documento de Inventario"
                displayId={String(document?.id ?? `#${documentId}`)}
                subtitle={document?.document_type_display ?? ''}
            >
                {(() => {
                    const doc = document
                    if (!doc) return null
                    return (
                        <>
                            <div className="text-[9px] space-y-1 mb-2 border-b pb-2">
                                <div className="flex justify-between">
                                    <span>Tipo:</span>
                                    <span>{doc.document_type_display}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Estado:</span>
                                    <span>{doc.status_display}</span>
                                </div>
                                {doc.partner_name && (
                                    <div className="flex justify-between">
                                        <span>Contacto:</span>
                                        <span>{doc.partner_name}</span>
                                    </div>
                                )}
                                {doc.reference && (
                                    <div className="flex justify-between">
                                        <span>Referencia:</span>
                                        <span>{doc.reference}</span>
                                    </div>
                                )}
                            </div>
                            {doc.details?.map((line, idx) => (
                                <div key={idx} className="flex justify-between text-[10px]">
                                    <span className="flex-1">{line.product_name}</span>
                                    <span className="w-24 text-right">
                                        {line.source_warehouse_name ? `${line.source_warehouse_name} ➔ ` : ''}{line.warehouse_name}
                                    </span>
                                    <span className="w-16 text-right">{line.quantity} {line.uom_name}</span>
                                    <span className="w-16 text-right">{formatCurrency(Number(line.unit_cost || 0))}</span>
                                </div>
                            ))}
                        </>
                    )
                })()}
            </PrintableLayout>

            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="right"
                boundary="embedded"
                defaultSize={formDrawerWidth("master", false)}
                title={identity.title}
                headerActions={
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>
                    </div>
                }
                subtitle={identity.subtitle}
                icon={identity.icon}
            >
                {isLoading ? (
                    <SkeletonShell isLoading={true} ariaLabel="Cargando documento" />
                ) : document ? (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground text-xs block">Tipo</span>
                                    <p className="font-semibold">{document.document_type_display}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs block">Estado</span>
                                    <p><StatusBadge status={document.status} /></p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs block">Fecha</span>
                                    <p className="font-medium">{document.date}</p>
                                </div>
                                {document.partner_name && (
                                    <div>
                                        <span className="text-muted-foreground text-xs block">Contacto/Socio</span>
                                        <p className="font-medium">{document.partner_name}</p>
                                    </div>
                                )}
                                {document.reference && (
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground text-xs block">Referencia</span>
                                        <p className="font-medium font-mono text-xs">{document.reference}</p>
                                    </div>
                                )}
                                {document.notes && (
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground text-xs block">Notas</span>
                                        <p className="font-medium text-xs text-muted-foreground bg-muted/30 p-2 rounded">{document.notes}</p>
                                    </div>
                                )}
                                <div>
                                    <span className="text-muted-foreground text-xs block">Creado Por</span>
                                    <p className="font-medium text-xs">{document.created_by_name || '-'}</p>
                                </div>
                                {document.confirmed_by_name && (
                                    <div>
                                        <span className="text-muted-foreground text-xs block">Confirmado Por</span>
                                        <p className="font-medium text-xs">{document.confirmed_by_name}</p>
                                    </div>
                                )}
                            </div>

                            {document.details && document.details.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold mb-2">Líneas de Detalle</h4>
                                    <div className="border rounded-md overflow-hidden">
                                        <DataTable
                                            columns={columns as unknown as ColumnDef<Record<string, unknown>>[]}
                                            data={document.details as unknown as Record<string, unknown>[]}
                                            variant="minimal"
                                            hidePagination
                                            noBorder
                                            emptyState={{
                                                title: "No hay líneas",
                                                description: "No se encontraron líneas de detalle."
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer actions for confirming/annulling documents */}
                        {document.status === "DRAFT" && (
                            <div className="border-t p-4 flex gap-2 bg-background">
                                <Button 
                                    className="flex-1" 
                                    onClick={handleConfirm} 
                                    disabled={isConfirming}
                                >
                                    <Check className="mr-2 h-4 w-4" /> Confirmar Documento
                                </Button>
                            </div>
                        )}

                        {document.status === "CONFIRMED" && (
                            <div className="border-t p-4 flex gap-2 bg-background">
                                <Button 
                                    variant="destructive"
                                    className="flex-1" 
                                    onClick={handleAnnul} 
                                    disabled={isAnnulling}
                                >
                                    <XCircle className="mr-2 h-4 w-4" /> Anular Documento
                                </Button>
                            </div>
                        )}
                    </div>
                ) : null}
            </Drawer>
        </>
    )
}
