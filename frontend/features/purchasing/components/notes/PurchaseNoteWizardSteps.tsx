import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {CheckCircle2, FileText, Package, AlertCircle} from "lucide-react"
import { cn } from "@/lib/utils"
import {DataCell, DocumentAttachmentDropzone, EmptyState, FolioValidationInput, LabeledContainer, PeriodValidationDateInput, DataTable} from '@/components/shared'
import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { PaymentMethodSelector, type PaymentData } from "@/features/treasury"

// --- STEP 1: General Information ---

interface Step1Props {
    noteType: "NOTA_CREDITO" | "NOTA_DEBITO"
    setNoteType: (type: "NOTA_CREDITO" | "NOTA_DEBITO") => void
    documentNumber: string
    setDocumentNumber: (value: string) => void
    documentDate: Date | undefined
    setDocumentDate: (date: Date | undefined) => void
    attachment: File | null
    setAttachment: (file: File | null) => void
    contactId?: number
    onValidityChange?: (isValid: boolean) => void
    onPeriodValidityChange?: (isValid: boolean) => void
}

export function Step1_GeneralInfo({
    noteType,
    setNoteType,
    documentNumber,
    setDocumentNumber,
    documentDate,
    setDocumentDate,
    attachment,
    setAttachment,
    contactId,
    onValidityChange,
    onPeriodValidityChange
}: Step1Props) {
    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
                <h2 className="text-2xl font-black tracking-tight">Información General</h2>
                <p className="text-muted-foreground">
                    Define el tipo de documento y los datos básicos de identificación.
                </p>
            </div>

            <div className="grid gap-6">
                {/* Note Type Selection */}
                <LabeledContainer label="Tipo de Nota">
                    <div className="grid grid-cols-2 gap-4 p-1">
                        <div
                            className={cn(
                                "cursor-pointer rounded-md border-2 p-4 transition-all hover:bg-muted/50",
                                noteType === "NOTA_CREDITO"
                                    ? "border-warning bg-warning/10/50 ring-2 ring-warning/20"
                                    : "border-muted"
                            )}
                            onClick={() => setNoteType("NOTA_CREDITO")}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-full ${noteType === 'NOTA_CREDITO' ? 'bg-warning/10' : 'bg-muted'}`}>
                                    <FileText className={`h-5 w-5 ${noteType === 'NOTA_CREDITO' ? 'text-warning' : 'text-muted-foreground'}`} />
                                </div>
                                <span className={`font-black ${noteType === 'NOTA_CREDITO' ? 'text-warning' : 'text-muted-foreground'}`}>
                                    Nota de Crédito
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground ml-12">
                                Para anulaciones, descuentos o devoluciones. Rebaja la deuda.
                            </p>
                        </div>

                        <div
                            className={cn(
                                "cursor-pointer rounded-md border-2 p-4 transition-all hover:bg-muted/50",
                                noteType === "NOTA_DEBITO"
                                    ? "border-primary bg-primary/10/50 ring-2 ring-primary/20"
                                    : "border-muted"
                            )}
                            onClick={() => setNoteType("NOTA_DEBITO")}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-full ${noteType === 'NOTA_DEBITO' ? 'bg-primary/10' : 'bg-muted'}`}>
                                    <FileText className={`h-5 w-5 ${noteType === 'NOTA_DEBITO' ? 'text-primary' : 'text-muted-foreground'}`} />
                                </div>
                                <span className={`font-black ${noteType === 'NOTA_DEBITO' ? 'text-primary' : 'text-muted-foreground'}`}>
                                    Nota de Débito
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground ml-12">
                                Para aumentos de valor o facturación adicional. Aumenta la deuda.
                            </p>
                        </div>
                    </div>
                </LabeledContainer>

                {/* Document Number & Date */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <FolioValidationInput
                            value={documentNumber}
                            onChange={setDocumentNumber}
                            onValidityChange={onValidityChange}
                            contactId={contactId}
                            isPurchase={true}
                            dteType={noteType}
                            placeholder="Ej: 12345"
                            className="h-12 text-lg font-mono tracking-widest uppercase"
                            autoFocus
                        />
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            * Folio exacto del documento
                        </p>
                    </div>

                    <div className="space-y-3">
                        <PeriodValidationDateInput
                            date={documentDate}
                            onDateChange={setDocumentDate}
                            validationType="both"
                            onValidityChange={onPeriodValidityChange}
                            className="h-12 w-full"
                        />
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            * Fecha en que se emitió el documento
                        </p>
                    </div>
                </div>

                {/* Attachment */}
                <div className="space-y-3 pt-4 border-t">
                    <DocumentAttachmentDropzone
                        file={attachment}
                        onFileChange={setAttachment}
                        dteType={noteType}
                        label="Documento Adjunto (PDF/XML)"
                    />
                </div>
            </div>
        </div>
    )
}

// --- STEP 2: Line Items ---

import type { PurchaseNoteLine } from "../../types"

interface Step2Props {
    lines: PurchaseNoteLine[]
    setLines: (lines: PurchaseNoteLine[]) => void
    noteType: "NOTA_CREDITO" | "NOTA_DEBITO"
}

export function Step2_LineItems({ lines, setLines, noteType }: Step2Props) {
    const handleLineChange = (index: number, field: 'note_quantity' | 'note_unit_cost', value: string) => {
        const newLines = [...lines]
        newLines[index][field] = parseFloat(value) || 0
        setLines(newLines)
    }

    const columns = useMemo<ColumnDef<PurchaseNoteLine>[]>(() => [
        {
            header: "#",
            cell: ({ row }) => <DataCell.Code>{row.index + 1}</DataCell.Code>,
            meta: { align: "center" }
        },
        {
            header: "Producto / Descripción",
            cell: ({ row }) => {
                const line = row.original;
                return (
                    <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex flex-col gap-0.5 items-start text-left w-full">
                            <DataCell.Text className="justify-start text-left font-bold text-sm text-foreground">
                                {line.product_name}
                            </DataCell.Text>
                            <DataCell.Code className="justify-start text-left text-[10px] text-muted-foreground">
                                {line.product_code || '-'}
                            </DataCell.Code>
                        </div>
                    </div>
                )
            }
        },
        {
            header: "UOM",
            cell: ({ row }) => (
                <DataCell.Chip size="xs" intent="neutral" className="font-bold text-muted-foreground justify-center w-full">
                    {row.original.uom_name || 'UN'}
                </DataCell.Chip>
            ),
            meta: { align: "center" }
        },
        {
            header: "Cantidad Orig.",
            cell: ({ row }) => <DataCell.Number value={row.original.quantity} className="font-mono text-sm text-muted-foreground justify-center" />,
            meta: { align: "center" }
        },
        {
            header: "Cantidad Nota",
            cell: ({ row }) => {
                const line = row.original;
                const idx = row.index;
                const isSelected = line.note_quantity > 0;
                return (
                    <Input
                        type="number"
                        className={cn(
                            "h-9 text-center font-bold font-mono transition-all",
                            isSelected
                                ? (noteType === 'NOTA_CREDITO' ? "border-warning/20 ring-2 ring-warning/10" : "border-primary/20 ring-2 ring-primary/10")
                                : "border-muted bg-muted/20"
                        )}
                        value={line.note_quantity}
                        min={0}
                        max={noteType === 'NOTA_CREDITO' ? line.quantity : undefined}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (val < 0) return;
                            if (noteType === 'NOTA_DEBITO' || val <= line.quantity) {
                                handleLineChange(idx, 'note_quantity', e.target.value)
                            }
                        }}
                        onFocus={(e) => e.target.select()}
                    />
                )
            },
            meta: { align: "center" }
        },
        {
            header: "Costo Unit.",
            cell: ({ row }) => {
                const line = row.original;
                const idx = row.index;
                return (
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                        <Input
                            type="number"
                            className={cn(
                                "h-9 pl-6 text-right font-mono font-medium",
                                noteType === 'NOTA_CREDITO' ? "bg-muted/10" : "bg-background"
                            )}
                            value={line.note_unit_cost}
                            readOnly={noteType === 'NOTA_CREDITO'}
                            disabled={noteType === 'NOTA_CREDITO'}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val < 0) return;
                                handleLineChange(idx, 'note_unit_cost', e.target.value)
                            }}
                            onFocus={(e) => e.target.select()}
                        />
                    </div>
                )
            },
            meta: { align: "right" }
        },
        {
            header: "Subtotal",
            cell: ({ row }) => {
                const line = row.original;
                return <DataCell.Currency value={line.note_quantity * line.note_unit_cost} className="font-black justify-end" />
            },
            meta: { align: "right" }
        }
    ], [noteType, handleLineChange])

    // Determine max quantities for validation
    // For Credit Notes: max is original quantity (cannot return more than bought)
    // For Debit Notes: typically no hard limit, but logically related to original

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-2xl font-black tracking-tight">Selección de Productos</h2>
                    <p className="text-muted-foreground">
                        Indica las cantidades y montos afectados por la nota.
                    </p>
                </div>
                <div className={`px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider bg-muted text-muted-foreground`}>
                    {lines.filter(l => l.note_quantity > 0).length} ítems seleccionados
                </div>
            </div>

            <div className="border rounded-md overflow-hidden shadow-card bg-card">
                <DataTable
                    columns={columns}
                    data={lines}
                    variant="compact"
                    gridTemplate="grid-cols-[3rem_1fr_5rem_6rem_7rem_8rem_8rem]"
                    hidePagination
                    noBorder
                    emptyState={{
                        title: "No hay productos",
                        description: "No se encontraron líneas disponibles en el documento original."
                    }}
                    renderRow={(row, children) => {
                        const isSelected = row.original.note_quantity > 0;
                        return (
                            <div className={cn(
                                "transition-colors hover:bg-muted/20",
                                isSelected ? (noteType === 'NOTA_CREDITO' ? "bg-warning/10/40 hover:bg-warning/10/60" : "bg-primary/10/40 hover:bg-primary/10/60") : ""
                            )}>
                                {children}
                            </div>
                        )
                    }}
                />
            </div>

            <div className="bg-primary/10/50 border border-primary/10 p-4 rounded-md flex gap-3 text-sm text-primary">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>
                    Los montos calculados aquí son referenciales. El sistema ajustará automáticamente los impuestos (IVA)
                    basado en la configuración de los productos y proveedores.
                </p>
            </div>
        </div>
    )
}

// --- STEP 3: Review & Confirm ---

interface Step3Props {
    noteType: "NOTA_CREDITO" | "NOTA_DEBITO"
    documentNumber: string
    attachment: File | null
    lines: PurchaseNoteLine[]
    totals: {
        net: number
        tax: number
        total: number
    }
}

export function Step3_Review({
    noteType,
    documentNumber,
    attachment,
    lines,
    totals
}: Step3Props) {
    const selectedLines = lines.filter(l => l.note_quantity > 0)

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                <h2 className="text-2xl font-black tracking-tight">Confirmar Registro</h2>
                <p className="text-muted-foreground">
                    Revisa los datos antes de procesar el documento.
                </p>
            </div>

            <Card>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Tipo de Documento</p>
                            <p className="font-bold text-lg">
                                {noteType === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Número de Folio</p>
                            <p className="font-bold text-lg font-mono tracking-wider">{documentNumber}</p>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Ítems Afectados</p>
                            <span className="text-xs font-bold bg-muted px-2 py-1 rounded">{selectedLines.length}</span>
                        </div>

                         <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {selectedLines.map((line, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm py-2 border-b border-dashed last:border-0">
                                    <div className="flex-1 flex flex-col gap-0.5">
                                        <p className="font-medium truncate">{line.product_name}</p>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-muted-foreground font-mono">{line.note_quantity} x </span>
                                            <DataCell.Currency
                                                value={line.note_unit_cost}
                                                className="justify-start text-xs text-muted-foreground font-mono w-auto"
                                            />
                                        </div>
                                    </div>
                                    <DataCell.Currency
                                        value={line.note_quantity * line.note_unit_cost}
                                        className="justify-end font-bold w-auto"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    <div className="bg-muted/20 p-4 rounded-md space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Monto Neto</span>
                            <DataCell.Currency value={totals.net} className="justify-end font-mono font-medium w-auto" />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">IVA (19%)</span>
                            <DataCell.Currency value={totals.tax} className="justify-end font-mono font-medium w-auto" />
                        </div>
                        <div className="flex justify-between items-center text-lg font-black pt-2 border-t border-dashed">
                            <span>Total Final</span>
                            <DataCell.Currency value={totals.total} className="justify-end text-primary w-auto text-lg" />
                        </div>
                    </div>

                    {attachment && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded justify-center">
                            <FileText className="h-3 w-3" />
                            Adjunto: <span className="font-medium text-foreground">{attachment.name}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="text-center text-xs text-muted-foreground">
                <p>Al confirmar, se generarán los movimientos contables y de inventario correspondientes.</p>
            </div>
        </div>
    )
}

// --- STEP 4: Payment ---

interface Step4Props {
    noteType: "NOTA_CREDITO" | "NOTA_DEBITO"
    total: number
    paymentData: PaymentData
    setPaymentData: (data: PaymentData) => void
}

export function Step4_Payment({
    noteType,
    total,
    paymentData,
    setPaymentData
}: Step4Props) {
    // User requested logic:
    // Debit Notes (Issued) -> Sales Methods (Receiving money?)
    // Credit Notes -> Purchase Methods (Paying money / Outbound?)
    const operation = noteType === 'NOTA_DEBITO' ? 'sales' : 'purchases'

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1">
                <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3 text-xl">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    {noteType === 'NOTA_CREDITO' ? 'Método de Reembolso' : 'Método de Pago'}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {noteType === 'NOTA_CREDITO'
                        ? 'Seleccione cómo recibió la devolución de dinero (o deje pendiente para crédito a favor).'
                        : 'Seleccione cómo realizará el pago de esta nota de débito.'}
                </p>
            </div>

            <PaymentMethodSelector
                operation={operation}
                total={total}
                paymentData={paymentData}
                onPaymentDataChange={setPaymentData}
                labels={{
                    totalLabel: "Monto Total Nota",
                    amountLabel: noteType === 'NOTA_CREDITO' ? "Monto Reembolsado" : "Monto a Pagar",
                    differencePositiveLabel: "Excedente / Vuelto",
                    differenceNegativeLabel: noteType === 'NOTA_CREDITO' ? "Saldo Pendiente" : "Deuda Pendiente",
                    amountModalTitle: noteType === 'NOTA_CREDITO' ? "Monto a Reembolsar" : "Monto a Pagar",
                    amountModalDescription: "Ingrese el monto asociado al movimiento de tesorería."
                }}
            />
        </div>
    )
}
