"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DocumentAttachmentDropzoneProps {
    file: File | null
    onFileChange: (file: File | null) => void
    dteType?: string
    isPending?: boolean
    disabled?: boolean
    label?: string
    requiredOverride?: boolean
    accept?: string
}

export function DocumentAttachmentDropzone({
    file,
    onFileChange,
    dteType = '',
    isPending = false,
    disabled = false,
    label = "Archivo Adjunto",
    requiredOverride,
    accept = ".pdf,.xml,image/*"
}: DocumentAttachmentDropzoneProps) {
    // If requiredOverride is provided, use it.
    // Otherwise, if dteType is provided, it's required for all types except BOLETA and NONE, unless isPending is true.
    const isRequired = requiredOverride !== undefined 
        ? requiredOverride 
        : (dteType && dteType !== 'BOLETA' && dteType !== 'NONE' && !isPending);

    return (
        <div className={`space-y-2 ${disabled ? 'opacity-50' : ''}`}>
            <Label className="text-xs font-bold uppercase flex items-center gap-2">
                <Upload className="h-3 w-3" />
                {label}
                {isRequired && <span className="text-destructive font-black ml-1">*</span>}
            </Label>

            {!file ? (
                <div className="relative group min-h-[80px]">
                    <Input
                        type="file"
                        accept={accept}
                        className="h-full w-full cursor-pointer opacity-0 absolute inset-0 z-10"
                        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                        disabled={disabled}
                    />
                    <div className="h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center bg-background/50 transition-all group-hover:bg-primary/5 group-hover:border-primary/30">
                        <Upload className="h-4 w-4 text-muted-foreground mb-1 group-hover:text-primary" />
                        <p className="text-[10px] font-bold text-muted-foreground uppercase text-center px-4">
                            Seleccionar o arrastrar archivo al recuadro
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between p-3 bg-success/5 border rounded-lg animate-in zoom-in duration-300">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-success/10 rounded text-success">
                            <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold truncate max-w-[250px]" title={file.name}>{file.name}</span>
                            <span className="text-[10px] uppercase font-black text-success/50">{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                    </div>
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-full shrink-0" 
                        onClick={(e) => {
                            e.preventDefault();
                            onFileChange(null);
                        }}
                        disabled={disabled}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    )
}
