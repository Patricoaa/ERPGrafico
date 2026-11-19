"use client"

import {
    DocumentAttachmentDropzone,
    FolioValidationInput,
    PeriodValidationDateInput,
} from "@/components/shared"
import {
    ATTACHMENT_REQUIRED_DTE,
    type DteClass,
    type DteDirection,
} from "@/lib/dte"

export interface DteFolioFieldsProps {
    folio: string
    onFolioChange: (value: string) => void
    onFolioValidityChange?: (valid: boolean) => void
    issueDate: string
    onIssueDateChange: (value: string) => void
    onPeriodValidityChange?: (valid: boolean) => void
    attachment: File | null
    onAttachmentChange: (file: File | null) => void
    dteClass: DteClass
    direction?: DteDirection
    contactId?: number | null
    disabled?: boolean
    touchMode?: boolean
    className?: string
}

export function DteFolioFields({
    folio,
    onFolioChange,
    onFolioValidityChange,
    issueDate,
    onIssueDateChange,
    onPeriodValidityChange,
    attachment,
    onAttachmentChange,
    dteClass,
    direction = "sale",
    contactId,
    disabled = false,
    touchMode = false,
    className,
}: DteFolioFieldsProps) {
    const isPurchase = direction === "purchase"
    const requiresAttachment = ATTACHMENT_REQUIRED_DTE.has(dteClass)

    return (
        <div className={className ?? "space-y-4"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FolioValidationInput
                    value={folio}
                    onChange={onFolioChange}
                    onValidityChange={onFolioValidityChange}
                    dteType={dteClass}
                    contactId={contactId ?? undefined}
                    isPurchase={isPurchase}
                    disabled={disabled}
                    enableNumpad={touchMode}
                />

                <PeriodValidationDateInput
                    label="Fecha de Emisión"
                    date={issueDate ? new Date(`${issueDate}T12:00:00`) : undefined}
                    onDateChange={(d) => {
                        if (d) {
                            const year = d.getFullYear()
                            const month = String(d.getMonth() + 1).padStart(2, "0")
                            const day = String(d.getDate()).padStart(2, "0")
                            onIssueDateChange(`${year}-${month}-${day}`)
                        } else {
                            onIssueDateChange("")
                        }
                    }}
                    validationType="both"
                    onValidityChange={onPeriodValidityChange}
                    disabled={disabled}
                />

                <div className="col-span-1 sm:col-span-2">
                    <DocumentAttachmentDropzone
                        file={attachment}
                        onFileChange={onAttachmentChange}
                        dteType={dteClass}
                        isPending={false}
                        disabled={disabled}
                        label={requiresAttachment ? "Adjunto (obligatorio)" : "Adjunto (opcional)"}
                    />
                </div>
            </div>
        </div>
    )
}
