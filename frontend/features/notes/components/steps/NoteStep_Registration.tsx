"use client"

/**
 * NoteStep_Registration
 *
 * Unified DTE registration step for both sales and purchase note wizards.
 * Covers: folio number, emission date, file attachment, and "pending" toggle.
 *
 * Replaces:
 *  - features/billing/components/checkout/Step3_Registration.tsx
 *  - The registration fields inside purchasing/notes/Step1_GeneralInfo
 */

import { DocumentAttachmentDropzone, LabeledInput, LabeledCheckbox, PeriodValidationDateInput } from '@/components/shared'
import { FileText, Calendar, Hash, ShieldAlert } from 'lucide-react'
import { useServerDate } from '@/hooks/useServerDate'
import { useEffect } from 'react'
import type { NoteType, RegistrationData } from '@/features/notes'

interface NoteStep_RegistrationProps {
    isCreditNote: boolean
    noteType: NoteType
    data: RegistrationData
    setData: (data: RegistrationData | ((prev: RegistrationData) => RegistrationData)) => void
    onPeriodValidityChange?: (isValid: boolean) => void
}

export function NoteStep_Registration({
    isCreditNote,
    noteType,
    data,
    setData,
    onPeriodValidityChange,
}: NoteStep_RegistrationProps) {
    const { dateString } = useServerDate()

    // Sync server date when it arrives late
    useEffect(() => {
        if (dateString && !data.documentDate) {
            setData(prev => ({ ...prev, documentDate: dateString }))
        }
    }, [dateString]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="w-full h-full flex flex-col space-y-6">
            <div className="flex flex-col gap-1 text-left">
                <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    Registro de Documento
                </h3>
                <p className="text-sm text-muted-foreground">
                    Ingrese la información relacionada al DTE y adjunte el respaldo legal.
                </p>
            </div>

            <div className="space-y-4">
                <LabeledCheckbox
                    label="Documento Pendiente"
                    description="Emitiré/recibiré la nota luego"
                    checked={data.isPending}
                    onCheckedChange={(val) => {
                        const isChecked = !!val
                        if (isChecked) {
                            setData(prev => ({
                                ...prev,
                                isPending: true,
                                documentNumber: '',
                                attachment: null,
                            }))
                            onPeriodValidityChange?.(true)
                        } else {
                            setData(prev => ({ ...prev, isPending: false }))
                        }
                    }}
                />

                {!data.isPending && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-md bg-muted/10">
                            <LabeledInput
                                label="N° de Folio"
                                icon={<Hash className="h-3 w-3" />}
                                placeholder="Ej: 45223"
                                className="bg-background"
                                value={data.documentNumber}
                                onChange={(e) =>
                                    setData(prev => ({ ...prev, documentNumber: e.target.value }))
                                }
                                required
                            />

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    Fecha Emisión
                                </label>
                                <PeriodValidationDateInput
                                    date={data.documentDate ? new Date(data.documentDate + 'T12:00:00') : undefined}
                                    onDateChange={(d) => {
                                        if (d) {
                                            const year = d.getFullYear()
                                            const month = String(d.getMonth() + 1).padStart(2, '0')
                                            const day = String(d.getDate()).padStart(2, '0')
                                            setData(prev => ({ ...prev, documentDate: `${year}-${month}-${day}` }))
                                        } else {
                                            setData(prev => ({ ...prev, documentDate: '' }))
                                        }
                                    }}
                                    validationType="both"
                                    onValidityChange={onPeriodValidityChange}
                                />
                            </div>

                            <div className="col-span-2 pt-2 border-t mt-2">
                                <DocumentAttachmentDropzone
                                    file={data.attachment}
                                    onFileChange={(file) =>
                                        setData(prev => ({ ...prev, attachment: file }))
                                    }
                                    dteType={noteType}
                                    isPending={data.isPending}
                                />
                            </div>
                        </div>

                        <div className="flex items-start gap-2 p-3 bg-primary/10 text-primary rounded-md text-[11px] leading-tight">
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <p>
                                {isCreditNote
                                    ? 'Recuerde que la información ingresada debe coincidir exactamente con el documento tributario emitido en el SII.'
                                    : 'Los datos del documento deben coincidir con los registros del proveedor y el SII.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
