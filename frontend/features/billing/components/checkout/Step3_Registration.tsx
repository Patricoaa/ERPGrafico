"use client"

import { DocumentAttachmentDropzone, LabeledInput, LabeledSwitch, LabeledContainer, PeriodValidationDateInput, StepHeader } from '@/components/shared'
import { FileText, Hash, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { useServerDate } from "@/hooks/useServerDate"
import { useEffect } from "react"

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
        attachment: null as File | null
    }) as unknown as { document_number: string; document_date: string; is_pending: boolean; attachment: File | null }

    // Sync date when server date arrives
    useEffect(() => {
        if (dateString && !formData.document_date) {
            setData({ ...formData, document_date: dateString })
        }
    }, [dateString])

    return (
        <div className="space-y-6">
            <StepHeader title="Registro de Documento" description="Ingrese la información relacionada al DTE y adjunte el respaldo legal." icon={FileText} />

            <div className="space-y-4">
                <LabeledSwitch
                    label="Emisión"
                    description={formData.is_pending ? "Emitiré/recibiré el documento luego" : "Emisión inmediata"}
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
                    icon={<FileText className={cn("h-4 w-4 transition-colors", formData.is_pending ? "text-warning" : "text-muted-foreground/30")} />}
                    className={cn(formData.is_pending ? "bg-warning/5 border-warning/20 shadow-card" : "border-dashed")}
                />

                {!formData.is_pending && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-2 gap-4">
                            <LabeledInput
                                label="N° de Folio"
                                icon={<Hash className="h-3 w-3" />}
                                placeholder="Ej: 45223"
                                className="bg-background"
                                value={formData.document_number}
                                onChange={(e) => setData({ ...formData, document_number: e.target.value })}
                                required
                            />
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
                            <div className="col-span-2">
                                <DocumentAttachmentDropzone
                                    file={formData.attachment}
                                    onFileChange={(file) => setData({ ...formData, attachment: file })}
                                    dteType={isCreditNote ? "NOTA_CREDITO" : "NOTA_DEBITO"}
                                    isPending={formData.is_pending}
                                />
                            </div>
                        </div>

                        {/* Note hint */}
                        <div className="flex items-start gap-2 p-3 bg-primary/10 text-primary rounded-md text-[11px] leading-tight">
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

