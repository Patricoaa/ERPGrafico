"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { FileText, Calendar, Hash, Upload, X, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Step3_RegistrationProps {
    isCreditNote: boolean
    data: any
    setData: (data: any) => void
}

export function Step3_Registration({
    isCreditNote,
    data,
    setData
}: Step3_RegistrationProps) {

    const formData = data || {
        document_number: "",
        document_date: new Date().toISOString().split('T')[0],
        is_pending: false,
        attachment: null
    }

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
                            setData({
                                ...formData,
                                is_pending: isChecked,
                                document_number: isChecked ? '' : formData.document_number
                            });
                        }}
                    />
                    <Label htmlFor="is_pending" className="text-xs font-medium cursor-pointer">
                        Emitiré/recibiré la nota luego
                    </Label>
                </div>

                {!formData.is_pending && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Main Info Card */}
                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/10">
                            <div className="space-y-2">
                                <Label htmlFor="folio" className="text-xs font-bold uppercase flex items-center gap-2">
                                    <Hash className="h-3 w-3" />
                                    N° de Folio
                                    <span className="text-rose-500 font-black">*</span>
                                </Label>
                                <Input
                                    id="folio"
                                    placeholder="Ej: 45223"
                                    className="bg-background"
                                    value={formData.document_number}
                                    onChange={(e) => setData({ ...formData, document_number: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date" className="text-xs font-bold uppercase flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    Fecha Emisión
                                </Label>
                                <Input
                                    id="date"
                                    type="date"
                                    className="bg-background"
                                    value={formData.document_date}
                                    onChange={(e) => setData({ ...formData, document_date: e.target.value })}
                                />
                            </div>

                            {/* Attachment Section inside the card */}
                            <div className="col-span-2 space-y-2 pt-2 border-t mt-2">
                                <Label className="text-xs font-bold uppercase flex items-center gap-2">
                                    <Upload className="h-3 w-3" />
                                    Archivo Adjunto (Opcional)
                                    {isCreditNote && (
                                        <span className="text-rose-500 font-black ml-1 text-[10px]">OBLIGATORIO</span>
                                    )}
                                </Label>

                                {!formData.attachment ? (
                                    <div className="relative group min-h-[80px]">
                                        <Input
                                            type="file"
                                            accept=".pdf,.xml"
                                            className="h-full w-full cursor-pointer opacity-0 absolute inset-0 z-10"
                                            onChange={(e) => setData({ ...formData, attachment: e.target.files?.[0] || null })}
                                        />
                                        <div className="h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center bg-background/50 transition-all group-hover:bg-primary/5 group-hover:border-primary/30">
                                            <Upload className="h-4 w-4 text-muted-foreground mb-1 group-hover:text-primary" />
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Seleccionar respaldo</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between p-3 bg-emerald-500/5 border rounded-lg animate-in zoom-in duration-300">
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 bg-emerald-500/10 rounded text-emerald-600">
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-bold truncate max-w-[250px]">{formData.attachment.name}</span>
                                                <span className="text-[10px] uppercase font-black text-emerald-600/50">{(formData.attachment.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-full" onClick={() => setData({ ...formData, attachment: null })}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Note hint */}
                        <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-[11px] leading-tight">
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

