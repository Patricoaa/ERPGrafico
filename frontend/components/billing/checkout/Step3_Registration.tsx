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

    const setField = (field: string, value: any) => {
        setData({ ...formData, [field]: value })
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
                {/* Pending Checkbox at TOP */}
                <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-xl border border-dashed border-muted-foreground/20 transition-all hover:bg-muted/50">
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
                        className="h-5 w-5 rounded-md border-2"
                    />
                    <div className="space-y-0.5">
                        <Label htmlFor="is_pending" className="text-sm font-bold cursor-pointer flex items-center gap-2">
                            Emitiré/recibiré la nota luego
                        </Label>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                            Marque esta opción para generar el documento en estado borrador y registrarlo oficialmente más tarde.
                        </p>
                    </div>
                </div>

                {!formData.is_pending && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="folio" className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                    <Hash className="h-3.5 w-3.5" />
                                    N° de Folio
                                    <span className="text-rose-500 font-black">*</span>
                                </Label>
                                <Input
                                    id="folio"
                                    placeholder="Ej: 45223"
                                    className="h-10 font-bold bg-background border-2 rounded-xl transition-all"
                                    value={formData.document_number}
                                    onChange={(e) => setField('document_number', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date" className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5" />
                                    Fecha Emisión
                                </Label>
                                <Input
                                    id="date"
                                    type="date"
                                    className="h-10 font-bold bg-background border-2 rounded-xl transition-all"
                                    value={formData.document_date}
                                    onChange={(e) => setField('document_date', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <Upload className="h-3.5 w-3.5" />
                                Archivo Adjunto (Opcional)
                                {isCreditNote && <span className="text-rose-500 font-black ml-1 uppercase text-[8px] tracking-tight border-b-2 border-rose-500/20 pb-0.5">Obligatorio</span>}
                            </Label>

                            {!formData.attachment ? (
                                <div className="relative group min-h-[100px]">
                                    <Input
                                        type="file"
                                        accept=".pdf,.xml"
                                        className="h-full w-full cursor-pointer opacity-0 absolute inset-0 z-10"
                                        onChange={(e) => setField('attachment', e.target.files?.[0] || null)}
                                    />
                                    <div className="h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-muted/5 transition-all group-hover:bg-primary/5 group-hover:border-primary/30">
                                        <Upload className="h-5 w-5 text-muted-foreground mb-1 group-hover:text-primary transition-colors" />
                                        <p className="text-[10px] font-black text-muted-foreground tracking-widest uppercase">Seleccionar archivo respaldo</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-4 bg-emerald-500/5 border-2 border-emerald-500/10 rounded-xl animate-in zoom-in duration-300">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-bold truncate max-w-[200px] tracking-tight mb-0.5">{formData.attachment.name}</span>
                                            <span className="text-[10px] uppercase font-black text-emerald-600/50 tabular-nums">{(formData.attachment.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-full" onClick={() => setField('attachment', null)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

