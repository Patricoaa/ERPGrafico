"use client"

import { LabeledInput } from "@/components/shared"
import { Checkbox } from "@/components/ui/checkbox"
import { FileText, Calendar, Hash, ShieldAlert } from "lucide-react"
import { useServerDate } from "@/hooks/useServerDate"
import { useEffect } from "react"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"

import { PeriodValidationDateInput } from "@/components/shared/PeriodValidationDateInput"

interface Step3_RegistrationProps {
    isCreditNote: boolean
    data: Record<string, unknown>
    setData: (data: Record<string, unknown>) => void
    onPeriodValidityChange?: (isValid: boolean) => void
}

export function Step3_Registration({
    isCreditNote,
    data,
    setData,
    onPeriodValidityChange
}: Step3_RegistrationProps) {

    const { dateString } = useServerDate()
    const formData = (data || {
        document_number: "",
        document_date: "",
        is_pending: false,
        attachment: null
    }) as any

    // Sync date when server date arrives
    useEffect(() => {
        if (dateString && !formData.document_date) {
            setData({ ...formData, document_date: dateString })
        }
    }, [dateString])

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1 text-left">
                <h3 className=" font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    Registro de Documento
                </h3>
                <p className="text-sm text-muted-foreground">
                    Ingrese la información relacionada al DTE y adjunte el respaldo legal.
                </p>
            </div>

            <div className="space-y-4">
                {/* Pending Checkbox - Styled as in Step1_DTE */}
                <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-dashed transition-all hover:bg-muted/50">
                    <Checkbox
                        id="is_pending"
                        checked={formData.is_pending}
                        onCheckedChange={(val) => {
                            const isChecked = !!val;
                            if (isChecked) {
                                setData({
                                    ...formData,
                                    is_pending: true,
                                    document_number: '',
                                    attachment: null
                                });
                                onPeriodValidityChange?.(true);
                            } else {
                                setData({ ...formData, is_pending: false });
                            }
                        }}
                    />
                    <label htmlFor="is_pending" className="text-xs font-medium cursor-pointer">
                        Emitiré/recibiré la nota luego
                    </label>
                </div>

                {!formData.is_pending && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Main Info Card */}
                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/10">
                            <LabeledInput
                                label="N° de Folio"
                                icon={<Hash className="h-3 w-3" />}
                                placeholder="Ej: 45223"
                                className="bg-background"
                                value={formData.document_number}
                                onChange={(e) => setData({ ...formData, document_number: e.target.value })}
                                required
                            />
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    Fecha Emisión
                                </label>
                                <div>
                                    <PeriodValidationDateInput
                                        date={formData.document_date ? new Date(formData.document_date + 'T12:00:00') : undefined}
                                        onDateChange={(d) => {
                                            if (d) {
                                                const year = d.getFullYear()
                                                const month = String(d.getMonth() + 1).padStart(2, '0')
                                                const day = String(d.getDate()).padStart(2, '0')
                                                setData({ ...formData, document_date: `${year}-${month}-${day}` })
                                            } else {
                                                setData({ ...formData, document_date: "" })
                                            }
                                        }}
                                        validationType="both"
                                        onValidityChange={onPeriodValidityChange}
                                    />
                                </div>
                            </div>

                            {/* Attachment Section inside the card */}
                            <div className="col-span-2 pt-2 border-t mt-2">
                                <DocumentAttachmentDropzone
                                    file={formData.attachment}
                                    onFileChange={(file) => setData({ ...formData, attachment: file })}
                                    dteType={isCreditNote ? "NOTA_CREDITO" : "NOTA_DEBITO"}
                                    isPending={formData.is_pending}
                                />
                            </div>
                        </div>

                        {/* Note hint */}
                        <div className="flex items-start gap-2 p-3 bg-primary/10 text-primary rounded-lg text-[11px] leading-tight">
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <p>
                                Recuerde que la información ingresada debe coincidir exactamente con el documento tributario emitido en el SII.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

