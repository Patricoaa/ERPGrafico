"use client"

import { Input } from "@/components/ui/input"
import { Upload, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LabeledContainer } from "@/components/shared"

interface DocumentAttachmentDropzoneProps {
    file: File | null
    onFileChange: (file: File | null) => void
    dteType?: string
    isPending?: boolean
    disabled?: boolean
    label?: string
    requiredOverride?: boolean
    accept?: string
    /** @deprecated — leave label undefined instead */
    hideLabel?: boolean
}

export function DocumentAttachmentDropzone({
    file,
    onFileChange,
    dteType = '',
    isPending = false,
    disabled = false,
    label = "Archivo Adjunto",
    requiredOverride,
    accept = ".pdf,.xml,image/*",
    hideLabel = false,
}: DocumentAttachmentDropzoneProps) {
    const isRequired = requiredOverride !== undefined
        ? requiredOverride
        : (dteType && dteType !== 'BOLETA' && dteType !== 'NONE' && !isPending)

    const showLabel = !hideLabel && !!label

    return (
        <LabeledContainer
            label={showLabel ? label : undefined}
            required={!!isRequired}
            disabled={disabled}
        >
            {!file ? (
                <div className="relative group w-full min-h-[72px]">
                    <Input
                        type="file"
                        accept={accept}
                        className="h-full w-full cursor-pointer opacity-0 absolute inset-0 z-10"
                        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                        disabled={disabled}
                    />
                    <div className="min-h-[72px] w-full flex flex-col items-center justify-center gap-1 group-hover:text-primary transition-colors">
                        <Upload className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <p className="text-[10px] font-bold text-muted-foreground uppercase text-center px-4 group-hover:text-primary transition-colors">
                            Seleccionar o arrastrar archivo
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between w-full px-2 py-1.5 animate-in zoom-in duration-200">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 bg-success/10 rounded text-success shrink-0">
                            <FileText className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="text-xs font-bold truncate max-w-[220px] text-success">{file.name}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top">{file.name}</TooltipContent>
                            </Tooltip>
                            <span className="text-[10px] uppercase font-black text-muted-foreground">
                                {(file.size / 1024).toFixed(1)} KB
                            </span>
                        </div>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full shrink-0"
                        onClick={(e) => {
                            e.preventDefault()
                            onFileChange(null)
                        }}
                        disabled={disabled}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}
        </LabeledContainer>
    )
}
