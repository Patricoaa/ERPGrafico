"use client"

import { useEffect, useRef } from "react"
import { Ban, Check, Package } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { toast } from "sonner"
import { DataCell } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { PrintableLayout } from "@/features/_shared"
import { DocumentSheet, SHEET_LEFT } from "@/features/documents"
import { formatCurrency } from "@/lib/money"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { showApiError } from "@/lib/errors"
import { useInventoryDocument, useInventoryDocumentMutations } from "../hooks/useInventoryDocuments"
import { inventoryDocumentDetailEntity, inventoryDocumentDetailViews } from "../entity-view/inventoryDocumentDetail.entity"

interface InventoryDocumentDrawerProps {
    documentId?: number | null
    id?: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Ficha documental del documento de inventario (ADR-0083): contexto (tipo, fecha, contacto,
 * referencia, notas) + detalle de productos + relaciones (origen y movimientos). Confirmar
 * (borrador) y anular (confirmado) van en el menú de acciones.
 */
export function InventoryDocumentDrawer({ documentId, id, open, onOpenChange, onSuccess }: InventoryDocumentDrawerProps) {
    const entityId = documentId ?? id ?? null
    const { data: document, isLoading, isError } = useInventoryDocument(entityId)
    const { confirmDocument, isConfirming, annulDocument, isAnnulling } = useInventoryDocumentMutations(entityId ?? undefined)
    const { setEntityDisplay } = useGlobalModalActions()
    const linesCollection = useEntityCollection(inventoryDocumentDetailEntity, { rows: document?.details ?? [] }, { pagination: { mode: "none" } })

    useEffect(() => {
        if (document?.id && document.display_id) {
            setEntityDisplay('inventory.inventorydocument', document.id, document.display_id)
        }
    }, [document?.id, document?.display_id, setEntityDisplay])
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const run = async (action: () => Promise<unknown>, ok: string, fail: string) => {
        try {
            await action()
            toast.success(ok)
            onSuccess?.()
        } catch (error) {
            showApiError(error, fail)
        }
    }

    const title = document ? `${document.document_type_display} ${document.display_id}` : "Documento de Inventario"
    const primaryAction = document?.status === "DRAFT" && entityId ? {
        id: "confirm", label: "Confirmar documento", icon: Check, disabled: isConfirming,
        onClick: () => void run(() => confirmDocument(entityId), "Documento confirmado con éxito y stock actualizado.", "Error al confirmar documento"),
    } : null
    const actions = document?.status === "CONFIRMED" && entityId ? [{
        id: "annul", label: "Anular documento", icon: Ban, destructive: true, disabled: isAnnulling,
        onClick: () => void run(() => annulDocument(entityId), "Documento anulado con éxito.", "Error al anular documento"),
    }] : []

    return (
        <>
            <PrintableLayout ref={printRef} title="Documento de Inventario" displayId={document?.display_id ?? ''} subtitle={document?.document_type_display ?? ''}>
                {document && (
                    <>
                        <div className="text-4xs space-y-1 mb-2">
                            <div className="flex justify-between"><span>Tipo:</span><span>{document.document_type_display}</span></div>
                            {document.partner_name && <div className="flex justify-between"><span>Contacto:</span><span>{document.partner_name}</span></div>}
                            {document.reference && <div className="flex justify-between"><span>Referencia:</span><span>{document.reference}</span></div>}
                        </div>
                        {document.details?.map((line, idx) => (
                            <div key={idx} className="flex justify-between text-3xs">
                                <span className="flex-1">{line.product_name}</span>
                                <span className="w-24 text-right">{line.source_warehouse_name ? `${line.source_warehouse_name} → ` : ''}{line.warehouse_name}</span>
                                <span className="w-16 text-right">{line.quantity} {line.uom_name}</span>
                                <span className="w-16 text-right">{formatCurrency(Number(line.unit_cost || 0))}</span>
                            </div>
                        ))}
                    </>
                )}
            </PrintableLayout>

            <DocumentSheet
                label="inventory.inventorydocument"
                open={open}
                onOpenChange={onOpenChange}
                document={document ?? null}
                title={title}
                isLoading={isLoading}
                error={isError ? new Error("No se pudo cargar el documento.") : undefined}
                loadingLabel="Cargando documento"
                status={document?.status ?? null}
                auditType="inventory_document"
                primaryAction={primaryAction}
                actions={actions}
                onPrint={() => handlePrint()}
                context={document ? [
                    { label: "Tipo", value: document.document_type_display },
                    { label: "Fecha", value: document.date ? <DataCell.Date value={document.date} size="xs" className={SHEET_LEFT} /> : null },
                    { label: "Contacto", value: document.partner_name || null },
                    { label: "Referencia", value: document.reference ? <span className="font-mono">{document.reference}</span> : null },
                    { label: "Notas", value: document.notes || null, span: 4, hidden: !document.notes },
                ] : []}
                sections={[{
                    title: "Productos",
                    icon: Package,
                    content: (
                        <Collection.Root collection={linesCollection} label="Productos">
                            <Collection.View table={inventoryDocumentDetailViews.table} emptyTitle="Sin líneas" emptyDescription="El documento no tiene productos." />
                        </Collection.Root>
                    ),
                }]}
            />
        </>
    )
}
