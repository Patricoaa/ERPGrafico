"use client"

/**
 * NoteStep_Review
 *
 * Optional read-only review step before the payment step.
 * Used in the purchase flow. Skipped in sales flow.
 *
 * Replaces: features/purchasing/components/notes/PurchaseNoteWizardSteps Step3_Review
 */

import { CheckCircle2, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { DataCell } from '@/components/shared'
import type { NoteLineItem, NoteType } from '@/features/notes'
import type { RegistrationData } from '@/features/notes'

interface NoteStep_ReviewProps {
    noteType: NoteType
    registration: RegistrationData
    lines: NoteLineItem[]
    totalNet: number
    totalTax: number
    total: number
}

export function NoteStep_Review({
    noteType,
    registration,
    lines,
    totalNet,
    totalTax,
    total,
}: NoteStep_ReviewProps) {
    const activeLines = lines.filter(l => l.noteQuantity > 0)

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto" />
                <h2 className="text-2xl font-black tracking-tight">Confirmar Registro</h2>
                <p className="text-muted-foreground">Revisa los datos antes de procesar el documento.</p>
            </div>

            <Card>
                <CardContent className="p-6 space-y-6">
                    {/* Header info */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Tipo de Documento</p>
                            <p className="font-bold text-lg">
                                {noteType === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Número de Folio</p>
                            <p className="font-bold text-lg font-mono tracking-wider">
                                {registration.isPending ? '(Pendiente)' : registration.documentNumber || '—'}
                            </p>
                        </div>
                    </div>

                    <Separator />

                    {/* Line items */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Ítems Afectados</p>
                            <span className="text-xs font-bold bg-muted px-2 py-1 rounded">{activeLines.length}</span>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {activeLines.map((line, idx) => (
                                <div
                                    key={idx}
                                    className="flex justify-between items-center text-sm py-2 border-b border-dashed last:border-0"
                                >
                                    <div className="flex-1 flex flex-col gap-0.5">
                                        <p className="font-medium truncate">{line.productName}</p>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {line.noteQuantity} ×
                                            </span>
                                            <DataCell.Currency
                                                value={line.noteUnitPrice}
                                                className="justify-start text-xs text-muted-foreground font-mono w-auto"
                                            />
                                        </div>
                                    </div>
                                    <DataCell.Currency
                                        value={line.noteQuantity * line.noteUnitPrice}
                                        className="justify-end font-bold w-auto"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Totals */}
                    <div className="bg-muted/20 p-4 rounded-md space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Monto Neto</span>
                            <DataCell.Currency value={totalNet} className="justify-end font-mono font-medium w-auto" />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">IVA (19%)</span>
                            <DataCell.Currency value={totalTax} className="justify-end font-mono font-medium w-auto" />
                        </div>
                        <div className="flex justify-between items-center text-lg font-black pt-2 border-t border-dashed">
                            <span>Total Final</span>
                            <DataCell.Currency value={total} className="justify-end text-primary w-auto text-lg" />
                        </div>
                    </div>

                    {/* Attachment */}
                    {registration.attachment && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded justify-center">
                            <FileText className="h-3 w-3" />
                            Adjunto: <span className="font-medium text-foreground">{registration.attachment.name}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
                Al confirmar, se generarán los movimientos contables y de inventario correspondientes.
            </p>
        </div>
    )
}
