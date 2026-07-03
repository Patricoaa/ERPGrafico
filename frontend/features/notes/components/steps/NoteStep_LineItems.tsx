"use client"

/**
 * NoteStep_LineItems
 *
 * Unified line-items step for both sales and purchase note wizards.
 *
 * selectionMode:
 *   'select' — Sales flow. Lines come pre-loaded from the original invoice.
 *              The user checks a row to include it, then edits qty/price.
 *              Extra columns: Delivered qty, Reason.
 *              Renders a sticky-header <Table> (matches original Step1_Items UX).
 *
 *   'edit'   — Purchase flow. All lines are pre-listed; the user only
 *              adjusts note_quantity / note_unit_price.
 *              Renders a DataTable variant="compact" (matches Step2_LineItems UX).
 *
 * Replaces:
 *  - features/billing/components/checkout/Step1_Items.tsx          (selectionMode='select')
 *  - features/purchasing/components/notes/PurchaseNoteWizardSteps  (selectionMode='edit')
 */

import { useMemo, useCallback } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

import { AlertCircle, Package, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Chip, DataCell, DataTable, LabeledInput } from '@/components/shared'
import { type ColumnDef } from '@tanstack/react-table'
import { formatCurrency } from '@/lib/money'
import type { NoteLineItem, NoteType } from '@/features/notes'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type NoteLineItemsSelectionMode = 'select' | 'edit'

interface NoteStep_LineItemsProps {
    selectionMode: NoteLineItemsSelectionMode
    noteType: NoteType
    /** All available lines (from source document) */
    lines: NoteLineItem[]
    /** Only the lines included in this note (checked + qty > 0) */
    selectedLines: NoteLineItem[]
    onLinesChange: (lines: NoteLineItem[]) => void
    /** Whether original document was tax-exempt (sales only) */
    isExempt?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function updateLine(
    lines: NoteLineItem[],
    lineId: number | string,
    patch: Partial<NoteLineItem>,
): NoteLineItem[] {
    return lines.map(l => (l.lineId === lineId ? { ...l, ...patch } : l))
}

// ---------------------------------------------------------------------------
// Select mode (sales) — sticky <Table> with checkbox + reason field
// ---------------------------------------------------------------------------

function SelectModeTable({
    noteType,
    lines,
    selectedLines,
    onLinesChange,
    isExempt = false,
}: {
    noteType: NoteType
    lines: NoteLineItem[]
    selectedLines: NoteLineItem[]
    onLinesChange: (lines: NoteLineItem[]) => void
    isExempt: boolean
}) {
    const isCreditNote = noteType === 'NOTA_CREDITO'

    const isSelected = (lineId: number | string) => selectedLines.some(s => s.lineId === lineId)
    const getSelected = (lineId: number | string) => selectedLines.find(s => s.lineId === lineId)

    const toggleLine = (line: NoteLineItem) => {
        if (isSelected(line.lineId)) {
            onLinesChange(selectedLines.filter(s => s.lineId !== line.lineId))
        } else {
            onLinesChange([
                ...selectedLines,
                {
                    ...line,
                    noteQuantity: line.originalQuantity,
                    noteUnitPrice: line.noteUnitPrice,
                    reason: '',
                },
            ])
        }
    }

    const updateSelected = (lineId: number | string, patch: Partial<NoteLineItem>) => {
        onLinesChange(updateLine(selectedLines, lineId, patch))
    }

    const columns = useMemo<ColumnDef<NoteLineItem>[]>(
        () => [
            {
                id: 'select',
                header: () => <Tag className="h-4 w-4 mx-auto text-muted-foreground" />,
                cell: ({ row }) => {
                    const line = row.original
                    const selected = isSelected(line.lineId)
                    return (
                        <div className="w-full flex justify-center">
                            <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleLine(line)}
                                className="h-6 w-6 rounded-md border-2 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
                            />
                        </div>
                    )
                },
                meta: { align: 'center' },
            },
            {
                header: 'Producto / Servicio',
                cell: ({ row }) => {
                    const line = row.original
                    return (
                        <div className="flex flex-col gap-1 items-start w-full">
                            <span className="font-bold text-sm tracking-tight text-foreground leading-tight text-left">
                                {line.productName}
                            </span>
                            <div className="flex items-center gap-2">
                                <Chip size="xs" className="opacity-70">
                                    {line.productCode ?? line.productId}
                                </Chip>
                                {line.productType === 'MANUFACTURABLE' && (
                                    <Chip size="xs" intent="warning">Fab</Chip>
                                )}
                            </div>
                        </div>
                    )
                },
                meta: { align: 'left' },
            },
            {
                header: 'Original',
                cell: ({ row }) => {
                    const line = row.original
                    return (
                        <div className="flex flex-col items-end w-full">
                            <span className="font-bold text-xs tabular-nums text-muted-foreground/60">
                                {Math.floor(line.originalQuantity)}
                            </span>
                            <span className="text-[10px] font-medium opacity-70 text-muted-foreground/60">
                                {line.uomName}
                            </span>
                        </div>
                    )
                },
                meta: { align: 'right' },
            },
            {
                header: 'Entregado',
                cell: ({ row }) => {
                    const line = row.original
                    return (
                        <div className="flex flex-col items-end w-full">
                            <span className="font-black text-xs tabular-nums text-success">
                                {Math.floor(line.originalQuantity)}
                            </span>
                            <span className="text-[10px] font-bold text-success/60 uppercase">
                                {line.uomName}
                            </span>
                        </div>
                    )
                },
                meta: { align: 'right' },
            },
            {
                header: 'Cant. Nota',
                cell: ({ row }) => {
                    const line = row.original
                    const selected = isSelected(line.lineId)
                    const sel = getSelected(line.lineId)
                    const maxQty = isCreditNote ? line.originalQuantity : 999999
                    return (
                        <div className="relative group max-w-[100px] mx-auto w-full">
                            <LabeledInput
                                type="number"
                                step="1"
                                disabled={!selected}
                                value={sel?.noteQuantity ?? ''}
                                onChange={(e) => {
                                    let val = parseInt(e.target.value) || 0
                                    if (val > maxQty) val = maxQty
                                    if (val < 0) val = 0
                                    updateSelected(line.lineId, { noteQuantity: val })
                                }}
                                className={cn('h-10 text-center font-bold transition-all', !selected && 'opacity-50')}
                                max={maxQty}
                                min={0}
                            />
                            {selected && isCreditNote && (
                                <div className="absolute -top-3 -right-3">
                                    <Chip size="xs" intent="primary" className="border-2 border-background shadow-card">
                                        MAX {maxQty}
                                    </Chip>
                                </div>
                            )}
                        </div>
                    )
                },
                meta: { align: 'center' },
            },
            {
                header: 'Precio',
                cell: ({ row }) => {
                    const line = row.original
                    const selected = isSelected(line.lineId)
                    const sel = getSelected(line.lineId)
                    return (
                        <div className="max-w-[120px] mx-auto flex flex-col items-center gap-1 w-full">
                            <LabeledInput
                                type="number"
                                disabled={!selected || isCreditNote}
                                value={sel?.noteUnitPrice ?? ''}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0
                                    updateSelected(line.lineId, { noteUnitPrice: val })
                                }}
                                className={cn(
                                    'h-10 text-center font-bold transition-all tabular-nums',
                                    (!selected || isCreditNote) && 'opacity-50',
                                )}
                                min={0}
                            />
                            {isExempt && <Chip size="xs" intent="success">Exento</Chip>}
                        </div>
                    )
                },
                meta: { align: 'center' },
            },
            {
                header: 'Motivo',
                cell: ({ row }) => {
                    const line = row.original
                    const selected = isSelected(line.lineId)
                    const sel = getSelected(line.lineId)
                    return (
                        <LabeledInput
                            placeholder="Indique motivo..."
                            disabled={!selected}
                            value={sel?.reason ?? ''}
                            onChange={(e) => updateSelected(line.lineId, { reason: e.target.value })}
                            className={cn('h-10 text-xs font-medium placeholder:italic transition-all w-full', !selected && 'opacity-50')}
                        />
                    )
                },
                meta: { align: 'left' },
            },
        ],
        [isCreditNote, isSelected, getSelected, toggleLine, updateSelected, isExempt],
    )

    return (
        <div className="border rounded-md overflow-hidden shadow-card bg-card min-h-[400px]">
            <DataTable
                columns={columns}
                data={lines}
                variant="compact"
                gridTemplate="grid-cols-[3rem_minmax(180px,1fr)_4rem_5rem_7rem_8rem_minmax(120px,1fr)]"
                hidePagination
                noBorder
                emptyState={{
                    title: 'No hay productos',
                    description: 'No se encontraron líneas disponibles en el documento original.',
                }}
                renderRow={(row, children) => {
                    const selected = isSelected(row.original.lineId)
                    return (
                        <div
                            className={cn(
                                'transition-colors hover:bg-muted/5 h-20 items-center',
                                selected ? 'bg-primary/[0.02]' : '',
                            )}
                        >
                            {children}
                        </div>
                    )
                }}
            />
        </div>
    )
}

// ---------------------------------------------------------------------------
// Edit mode (purchase) — DataTable compact
// ---------------------------------------------------------------------------

function EditModeTable({
    noteType,
    lines,
    onLinesChange,
}: {
    noteType: NoteType
    lines: NoteLineItem[]
    onLinesChange: (lines: NoteLineItem[]) => void
}) {
    const isCreditNote = noteType === 'NOTA_CREDITO'

    const handleChange = useCallback(
        (index: number, field: 'noteQuantity' | 'noteUnitPrice', value: string) => {
            const next = [...lines]
            next[index] = { ...next[index], [field]: parseFloat(value) || 0 }
            onLinesChange(next)
        },
        [lines, onLinesChange],
    )

    const columns = useMemo<ColumnDef<NoteLineItem>[]>(
        () => [
            {
                header: '#',
                cell: ({ row }) => <DataCell.Code>{row.index + 1}</DataCell.Code>,
                meta: { align: 'center' },
            },
            {
                header: 'Producto / Descripción',
                cell: ({ row }) => (
                    <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex flex-col gap-0.5 items-start text-left w-full">
                            <DataCell.Text className="justify-start text-left font-bold text-sm text-foreground">
                                {row.original.productName}
                            </DataCell.Text>
                            <DataCell.Code className="justify-start text-left text-[10px] text-muted-foreground">
                                {row.original.productCode ?? '-'}
                            </DataCell.Code>
                        </div>
                    </div>
                ),
            },
            {
                header: 'UOM',
                cell: ({ row }) => (
                    <DataCell.Chip size="xs" intent="neutral" className="font-bold text-muted-foreground justify-center w-full">
                        {row.original.uomName ?? 'UN'}
                    </DataCell.Chip>
                ),
                meta: { align: 'center' },
            },
            {
                header: 'Cantidad Orig.',
                cell: ({ row }) => (
                    <DataCell.Number value={row.original.originalQuantity} className="font-mono text-sm text-muted-foreground justify-center" />
                ),
                meta: { align: 'center' },
            },
            {
                header: 'Cantidad Nota',
                cell: ({ row }) => {
                    const line = row.original
                    const idx = row.index
                    const isActive = line.noteQuantity > 0
                    return (
                        <Input
                            type="number"
                            className={cn(
                                'h-9 text-center font-bold font-mono transition-all max-w-[100px] mx-auto w-full',
                                isActive
                                    ? isCreditNote
                                        ? 'border-warning/20 ring-2 ring-warning/10'
                                        : 'border-primary/20 ring-2 ring-primary/10'
                                    : 'border-muted bg-muted/20',
                            )}
                            value={line.noteQuantity}
                            min={0}
                            max={isCreditNote ? line.originalQuantity : undefined}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                if (val < 0) return
                                if (isCreditNote && val > line.originalQuantity) return
                                handleChange(idx, 'noteQuantity', e.target.value)
                            }}
                            onFocus={(e) => e.target.select()}
                        />
                    )
                },
                meta: { align: 'center' },
            },
            {
                header: 'Precio Unit.',
                cell: ({ row }) => {
                    const line = row.original
                    const idx = row.index
                    return (
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                            <Input
                                type="number"
                                className={cn(
                                    'h-9 pl-6 text-right font-mono font-medium max-w-[120px] mx-auto w-full',
                                    isCreditNote ? 'bg-muted/10' : 'bg-background',
                                )}
                                value={line.noteUnitPrice}
                                readOnly={isCreditNote}
                                disabled={isCreditNote}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0
                                    if (val < 0) return
                                    handleChange(idx, 'noteUnitPrice', e.target.value)
                                }}
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                    )
                },
                meta: { align: 'right' },
            },
        ],
        [isCreditNote, handleChange],
    )

    const activeCount = lines.filter(l => l.noteQuantity > 0).length

    return (
        <>
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-2xl font-black tracking-tight">Selección de Productos</h2>
                    <p className="text-muted-foreground">Indica las cantidades y montos afectados por la nota.</p>
                </div>
                <div className="px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider bg-muted text-muted-foreground">
                    {activeCount} {activeCount === 1 ? 'ítem seleccionado' : 'ítems seleccionados'}
                </div>
            </div>

            <div className="border rounded-md overflow-hidden shadow-card bg-card">
                <DataTable
                    columns={columns}
                    data={lines}
                    variant="compact"
                    gridTemplate="grid-cols-[3rem_1fr_4rem_5rem_8rem_8rem]"
                    hidePagination
                    noBorder
                    emptyState={{
                        title: 'No hay productos',
                        description: 'No se encontraron líneas disponibles en el documento original.',
                    }}
                    renderRow={(row, children) => (
                        <div
                            className={cn(
                                'transition-colors hover:bg-muted/20',
                                row.original.noteQuantity > 0
                                    ? isCreditNote
                                        ? 'bg-warning/10/40 hover:bg-warning/10/60'
                                        : 'bg-primary/10/40 hover:bg-primary/10/60'
                                    : '',
                            )}
                        >
                            {children}
                        </div>
                    )}
                />
            </div>

            <div className="bg-primary/10/50 border border-primary/10 p-4 rounded-md flex gap-3 text-sm text-primary">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>
                    Los montos calculados aquí son referenciales. El sistema ajustará automáticamente los impuestos
                    basado en la configuración de los productos.
                </p>
            </div>
        </>
    )
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function NoteStep_LineItems({
    selectionMode,
    noteType,
    lines,
    selectedLines,
    onLinesChange,
    isExempt = false,
}: NoteStep_LineItemsProps) {
    const totalNet = selectedLines.reduce((acc, l) => acc + l.noteQuantity * l.noteUnitPrice, 0)

    return (
        <div className="w-full h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {selectionMode === 'select' ? (
                <>
                    <div className="flex flex-col gap-1">
                        <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                            <Package className="h-5 w-5 text-primary" />
                            Selección de Productos
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Seleccione los ítems de la factura original que desea corregir.
                        </p>
                    </div>
                    <SelectModeTable
                        noteType={noteType}
                        lines={lines}
                        selectedLines={selectedLines}
                        onLinesChange={onLinesChange}
                        isExempt={isExempt}
                    />
                    {selectedLines.length > 0 && (
                        <div className="flex justify-end text-sm font-bold text-muted-foreground">
                            Subtotal seleccionado:&nbsp;
                            <span className="text-foreground font-black">{formatCurrency(totalNet)}</span>
                        </div>
                    )}
                </>
            ) : (
                <EditModeTable
                    noteType={noteType}
                    lines={lines}
                    onLinesChange={onLinesChange}
                />
            )}
        </div>
    )
}
