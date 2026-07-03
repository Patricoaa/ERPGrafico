"use client"

/**
 * NoteStep_TypeSelector
 *
 * Optional first step that lets the user choose between NOTA_CREDITO and NOTA_DEBITO.
 * Used in the purchase flow where the type is not pre-determined.
 * In the sales flow, initialType is fixed and this step is skipped.
 *
 * Replaces the type-selector cards inside purchasing/notes/Step1_GeneralInfo.
 */

import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NoteType } from '@/features/notes'

interface NoteStep_TypeSelectorProps {
    noteType: NoteType
    onNoteTypeChange: (type: NoteType) => void
}

export function NoteStep_TypeSelector({ noteType, onNoteTypeChange }: NoteStep_TypeSelectorProps) {
    return (
        <div className="w-full h-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
                <h2 className="text-2xl font-black tracking-tight">Tipo de Documento</h2>
                <p className="text-muted-foreground">
                    Selecciona el tipo de nota que deseas registrar para este documento.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 p-1">
                {/* Nota de Crédito */}
                <button
                    type="button"
                    className={cn(
                        'cursor-pointer rounded-md border-2 p-6 transition-all hover:bg-muted/50 text-left',
                        noteType === 'NOTA_CREDITO'
                            ? 'border-warning bg-warning/10/50 ring-2 ring-warning/20'
                            : 'border-muted',
                    )}
                    onClick={() => onNoteTypeChange('NOTA_CREDITO')}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className={cn('p-2 rounded-full', noteType === 'NOTA_CREDITO' ? 'bg-warning/10' : 'bg-muted')}>
                            <FileText
                                className={cn('h-5 w-5', noteType === 'NOTA_CREDITO' ? 'text-warning' : 'text-muted-foreground')}
                            />
                        </div>
                        <span className={cn('font-black text-lg', noteType === 'NOTA_CREDITO' ? 'text-warning' : 'text-muted-foreground')}>
                            Nota de Crédito
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Para anulaciones, descuentos o devoluciones. <strong>Rebaja</strong> el monto adeudado.
                    </p>
                </button>

                {/* Nota de Débito */}
                <button
                    type="button"
                    className={cn(
                        'cursor-pointer rounded-md border-2 p-6 transition-all hover:bg-muted/50 text-left',
                        noteType === 'NOTA_DEBITO'
                            ? 'border-primary bg-primary/10/50 ring-2 ring-primary/20'
                            : 'border-muted',
                    )}
                    onClick={() => onNoteTypeChange('NOTA_DEBITO')}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className={cn('p-2 rounded-full', noteType === 'NOTA_DEBITO' ? 'bg-primary/10' : 'bg-muted')}>
                            <FileText
                                className={cn('h-5 w-5', noteType === 'NOTA_DEBITO' ? 'text-primary' : 'text-muted-foreground')}
                            />
                        </div>
                        <span className={cn('font-black text-lg', noteType === 'NOTA_DEBITO' ? 'text-primary' : 'text-muted-foreground')}>
                            Nota de Débito
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Para aumentos de valor o facturación adicional. <strong>Aumenta</strong> el monto adeudado.
                    </p>
                </button>
            </div>
        </div>
    )
}
