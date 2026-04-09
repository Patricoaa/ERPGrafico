
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, FileText, Package, AlertCircle, UploadCloud } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"
import { PaymentMethodCardSelector, PaymentData } from "@/features/treasury/components/PaymentMethodCardSelector"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"
import { EmptyState } from "@/components/shared/EmptyState"

// --- STEP 1: General Information ---

interface Step1Props {
    noteType: "NOTA_CREDITO" | "NOTA_DEBITO"
    setNoteType: (type: "NOTA_CREDITO" | "NOTA_DEBITO") => void
    documentNumber: string
    setDocumentNumber: (value: string) => void
    attachment: File | null
    setAttachment: (file: File | null) => void
}

export function Step1_GeneralInfo({
    noteType,
    setNoteType,
    documentNumber,
    setDocumentNumber,
    attachment,
    setAttachment
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
                <div className="space-y-3">
                    <Label className="text-base font-bold">Tipo de Nota</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <div
                            className={cn(
                                "cursor-pointer rounded-lg border-2 p-4 transition-all hover:bg-muted/50",
                                noteType === "NOTA_CREDITO"
                                    ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20"
                                    : "border-muted"
                            )}
                            onClick={() => setNoteType("NOTA_CREDITO")}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-full ${noteType === 'NOTA_CREDITO' ? 'bg-amber-100' : 'bg-muted'}`}>
                                    <FileText className={`h-5 w-5 ${noteType === 'NOTA_CREDITO' ? 'text-amber-700' : 'text-muted-foreground'}`} />
                                </div>
                                <span className={`font-black ${noteType === 'NOTA_CREDITO' ? 'text-amber-900' : 'text-muted-foreground'}`}>
                                    Nota de Crédito
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground ml-12">
                                Para anulaciones, descuentos o devoluciones. Rebaja la deuda.
                            </p>
                        </div>

                        <div
                            className={cn(
                                "cursor-pointer rounded-lg border-2 p-4 transition-all hover:bg-muted/50",
                                noteType === "NOTA_DEBITO"
                                    ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
                                    : "border-muted"
                            )}
                            onClick={() => setNoteType("NOTA_DEBITO")}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-full ${noteType === 'NOTA_DEBITO' ? 'bg-blue-100' : 'bg-muted'}`}>
                                    <FileText className={`h-5 w-5 ${noteType === 'NOTA_DEBITO' ? 'text-primary' : 'text-muted-foreground'}`} />
                                </div>
                                <span className={`font-black ${noteType === 'NOTA_DEBITO' ? 'text-blue-900' : 'text-muted-foreground'}`}>
                                    Nota de Débito
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground ml-12">
                                Para aumentos de valor o facturación adicional. Aumenta la deuda.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Document Number */}
                <div className="space-y-3">
                    <Label className="text-base font-bold">Número de Folio</Label>
                    <Input
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                        placeholder="Ej: 12345"
                        className="h-12 text-lg font-mono tracking-widest uppercase"
                        autoFocus
                    />
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        * Ingrese el número exacto que aparece en el documento físico/digital
                    </p>
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

interface Step2Props {
    lines: any[]
    setLines: (lines: any[]) => void
    noteType: "NOTA_CREDITO" | "NOTA_DEBITO"
}

export function Step2_LineItems({ lines, setLines, noteType }: Step2Props) {
    const handleLineChange = (index: number, field: string, value: string) => {
        const newLines = [...lines]
        newLines[index][field] = parseFloat(value) || 0
        setLines(newLines)
    }

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
                <div className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-muted text-muted-foreground`}>
                    {lines.filter(l => l.note_quantity > 0).length} ítems seleccionados
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
                <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b">
                        <tr>
                            <th className="px-4 py-3 text-left font-black text-[10px] uppercase tracking-widest text-muted-foreground w-[40px]">#</th>
                            <th className="px-4 py-3 text-left font-black text-[10px] uppercase tracking-widest text-muted-foreground">Producto / Descripción</th>
                            <th className="px-4 py-3 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground w-24">UOM</th>
                            <th className="px-4 py-3 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground w-28">Cant. Orig.</th>
                            <th className="px-4 py-3 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground w-32">Cant. Nota</th>
                            <th className="px-4 py-3 text-right font-black text-[10px] uppercase tracking-widest text-muted-foreground w-40">Costo Unit.</th>
                            <th className="px-4 py-3 text-right font-black text-[10px] uppercase tracking-widest text-muted-foreground w-40">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {lines.map((line, idx) => {
                            const isSelected = line.note_quantity > 0
                            return (
                                <tr
                                    key={line.id}
                                    className={cn(
                                        "transition-colors hover:bg-muted/20",
                                        isSelected ? (noteType === 'NOTA_CREDITO' ? "bg-amber-50/40" : "bg-blue-50/40") : ""
                                    )}
                                >
                                    <td className="px-4 py-3 text-center text-xs text-muted-foreground font-mono">
                                        {idx + 1}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-muted/50 rounded-lg">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-foreground">{line.product_name}</p>
                                                <p className="text-[10px] font-mono text-muted-foreground uppercase">{line.product_code || '-'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-xs font-bold text-muted-foreground">
                                        {line.uom_name || 'UN'}
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono text-sm text-muted-foreground">
                                        {line.quantity}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Input
                                            type="number"
                                            className={cn(
                                                "h-9 text-center font-bold font-mono transition-all",
                                                isSelected
                                                    ? (noteType === 'NOTA_CREDITO' ? "border-amber-300 ring-2 ring-amber-100" : "border-blue-300 ring-2 ring-blue-100")
                                                    : "border-muted bg-muted/20"
                                            )}
                                            value={line.note_quantity}
                                            min={0}
                                            max={noteType === 'NOTA_CREDITO' ? line.quantity : undefined}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                // Prevent negative
                                                if (val < 0) return;

                                                if (noteType === 'NOTA_DEBITO' || val <= line.quantity) {
                                                    handleLineChange(idx, 'note_quantity', e.target.value)
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                                            <Input
                                                type="number"
                                                className={cn(
                                                    "h-9 pl-6 text-right font-mono font-medium",
                                                    noteType === 'NOTA_CREDITO' ? "bg-muted/10" : "bg-white"
                                                )}
                                                value={line.note_unit_cost}
                                                readOnly={noteType === 'NOTA_CREDITO'} // Usually credit notes maintain original price, but strictly speaking sometimes price adjustments happen.
                                                // However, for simplified logic: Refund = Qty * Historic Price.
                                                // If it's a price adjustment (same qty, price diff), that's a partial credit note but usually handled as "value".
                                                // For now keeping readOnly for Credit Note as per original logic to avoid complexity.
                                                onChange={(e) => handleLineChange(idx, 'note_unit_cost', e.target.value)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-black font-mono text-sm">
                                        {formatCurrency(line.note_quantity * line.note_unit_cost)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {lines.length === 0 && (
                    <EmptyState context="inventory" variant="compact" description="No se encontraron líneas disponibles en la orden original" />
                )}
            </div>

            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg flex gap-3 text-sm text-blue-800">
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
    lines: any[]
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
                <div className="inline-flex items-center justify-center p-4 bg-emerald-100 rounded-full mb-4">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
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
                                <div key={idx} className="flex justify-between text-sm py-2 border-b border-dashed last:border-0">
                                    <div className="flex-1">
                                        <p className="font-medium truncate">{line.product_name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{line.note_quantity} x {formatCurrency(line.note_unit_cost)}</p>
                                    </div>
                                    <div className="font-bold text-right">
                                        {formatCurrency(line.note_quantity * line.note_unit_cost)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    <div className="bg-muted/20 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Monto Neto</span>
                            <span className="font-mono font-medium">{formatCurrency(totals.net)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">IVA (19%)</span>
                            <span className="font-mono font-medium">{formatCurrency(totals.tax)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-black pt-2 border-t border-dashed">
                            <span>Total Final</span>
                            <span className="text-primary">{formatCurrency(totals.total)}</span>
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

            <PaymentMethodCardSelector
                operation={operation}
                total={total}
                paymentData={paymentData}
                onPaymentDataChange={setPaymentData}
                compactMode={false}
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
