"use client"

/**
 * NoteStep_LineItems
 *
 * Unified line-items step for both sales and purchase note wizards.
 *
 * selectionMode:
 *   'select' — Sales flow. Lines come pre-loaded from the original invoice.
 *              The user checks a row to include it, then edits qty/price and adds a reason.
 *
 *   'edit'   — Purchase flow. All lines are pre-listed; the user only
 *              adjusts note_quantity / note_unit_price.
 */

import * as React from "react"
import { Package } from "lucide-react"
import { defineEditable, EditableCollection, type EditableRowValue } from "@/components/entity-view"
import type { NoteLineItem, NoteType } from "@/features/notes"
import { noteLineEntity } from "../../entity-view/noteLine.entity"

// ── Props ─────────────────────────────────────────────────────────────────────

export type NoteLineItemsSelectionMode = "select" | "edit"

interface NoteStep_LineItemsProps {
    selectionMode: NoteLineItemsSelectionMode
    noteType: NoteType
    /** All available lines (from source document) */
    lines: NoteLineItem[]
    /** Only the lines included in this note (checked + qty > 0). Used only in select mode. */
    selectedLines: NoteLineItem[]
    onLinesChange: (lines: NoteLineItem[]) => void
    /** Whether original document was tax-exempt (reserved — not used in collection rendering) */
    isExempt?: boolean
}

// ── Value derivation (controlled: parent holds the truth) ─────────────────────

function toSelectValue(lines: NoteLineItem[], selectedLines: NoteLineItem[]): EditableRowValue[] {
    const selMap = new Map(selectedLines.map((s) => [String(s.lineId), s]))
    return lines.map((line) => {
        const sel = selMap.get(String(line.lineId))
        return {
            key: String(line.lineId),
            values: {
                noteQuantity: sel?.noteQuantity ?? 0,
                noteUnitPrice: sel?.noteUnitPrice ?? line.noteUnitPrice,
            },
            textValues: { motivo: sel?.reason ?? "" },
            selected: selMap.has(String(line.lineId)),
        }
    })
}

function toEditValue(lines: NoteLineItem[]): EditableRowValue[] {
    return lines.map((line) => ({
        key: String(line.lineId),
        values: {
            noteQuantity: line.noteQuantity,
            noteUnitPrice: line.noteUnitPrice,
        },
    }))
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NoteLineItemsStep({
    selectionMode,
    noteType,
    lines,
    selectedLines,
    onLinesChange,
}: NoteStep_LineItemsProps) {
    const isCreditNote = noteType === "NOTA_CREDITO"

    // ── Select-mode editable ──────────────────────────────────────────────────
    const selectEditable = React.useMemo(
        () =>
            defineEditable(noteLineEntity, {
                rowKey: (l) => String(l.lineId),
                context: ["product", "originalQty", "deliveredQty"] as const,
                inputs: {
                    noteQuantity: {
                        kind: "quantity" as const,
                        header: "Cant. Nota",
                        label: (l: NoteLineItem) => `Cantidad de nota — ${l.productName}`,
                        min: 0,
                        max: isCreditNote ? (l: NoteLineItem) => l.originalQuantity : undefined,
                        step: () => 1,
                    },
                    noteUnitPrice: {
                        kind: "money" as const,
                        header: "Precio",
                        label: (l: NoteLineItem) => `Precio de nota — ${l.productName}`,
                        readOnly: isCreditNote,
                        initial: (l: NoteLineItem) => l.noteUnitPrice,
                    },
                    motivo: {
                        kind: "text" as const,
                        header: "Motivo",
                        label: (l: NoteLineItem) => `Motivo — ${l.productName}`,
                        placeholder: "Indique motivo...",
                    },
                },
                select: { label: (l: NoteLineItem) => `Seleccionar ${l.productName}` },
                processed: ["noteQuantity"],
            }),
        [isCreditNote],
    )

    // ── Edit-mode editable ────────────────────────────────────────────────────
    const editEditable = React.useMemo(
        () =>
            defineEditable(noteLineEntity, {
                rowKey: (l) => String(l.lineId),
                context: ["product", "uom", "originalQty"] as const,
                inputs: {
                    noteQuantity: {
                        kind: "quantity" as const,
                        header: "Cantidad Nota",
                        label: (l: NoteLineItem) => `Cantidad de nota — ${l.productName}`,
                        min: 0,
                        max: isCreditNote ? (l: NoteLineItem) => l.originalQuantity : undefined,
                        step: () => 1,
                    },
                    noteUnitPrice: {
                        kind: "money" as const,
                        header: "Precio Unit.",
                        label: (l: NoteLineItem) => `Precio unitario — ${l.productName}`,
                        readOnly: isCreditNote,
                        initial: (l: NoteLineItem) => l.noteUnitPrice,
                    },
                },
                processed: ["noteQuantity"],
            }),
        [isCreditNote],
    )

    // ── Derived value (controlled: no local state) ────────────────────────────
    const selectValue = React.useMemo(() => toSelectValue(lines, selectedLines), [lines, selectedLines])
    const editValue = React.useMemo(() => toEditValue(lines), [lines])

    // ── Change handlers ───────────────────────────────────────────────────────
    const handleSelectChange = React.useCallback(
        (next: EditableRowValue[]) => {
            const selected = next
                .filter((v) => v.selected)
                .flatMap((v) => {
                    const line = lines.find((l) => String(l.lineId) === v.key)
                    if (!line) return []
                    return [{
                        ...line,
                        noteQuantity: v.values.noteQuantity ?? 0,
                        noteUnitPrice: v.values.noteUnitPrice ?? line.noteUnitPrice,
                        reason: v.textValues?.motivo ?? "",
                    }]
                })
            onLinesChange(selected)
        },
        [lines, onLinesChange],
    )

    const handleEditChange = React.useCallback(
        (next: EditableRowValue[]) => {
            const updated = next.flatMap((v) => {
                const line = lines.find((l) => String(l.lineId) === v.key)
                if (!line) return []
                return [{
                    ...line,
                    noteQuantity: v.values.noteQuantity ?? 0,
                    noteUnitPrice: v.values.noteUnitPrice ?? line.noteUnitPrice,
                }]
            })
            onLinesChange(updated)
        },
        [lines, onLinesChange],
    )

    const activeCount = editValue.filter((v) => (v.values.noteQuantity ?? 0) > 0).length

    if (lines.length === 0) {
        return (
            <div className="surface-panel px-6 py-10 text-center text-sm text-muted-foreground">
                No se encontraron líneas disponibles en el documento original.
            </div>
        )
    }

    return (
        <div className="w-full h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {selectionMode === "select" ? (
                <>
                    <div className="flex flex-col gap-1">
                        <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                            <Package className="h-5 w-5 text-primary" aria-hidden />
                            Selección de Productos
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Seleccione los ítems de la factura original que desea corregir.
                        </p>
                    </div>
                    <EditableCollection
                        definition={selectEditable}
                        rows={lines}
                        value={selectValue}
                        onChange={handleSelectChange}
                        label="Líneas de nota de venta"
                    />
                </>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">Selección de Productos</h2>
                            <p className="text-muted-foreground">Indica las cantidades y montos afectados por la nota.</p>
                        </div>
                        <div className="px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider bg-muted text-muted-foreground">
                            {activeCount} {activeCount === 1 ? "ítem seleccionado" : "ítems seleccionados"}
                        </div>
                    </div>
                    <EditableCollection
                        definition={editEditable}
                        rows={lines}
                        value={editValue}
                        onChange={handleEditChange}
                        label="Líneas de nota de compra"
                    />
                </>
            )}
        </div>
    )
}
