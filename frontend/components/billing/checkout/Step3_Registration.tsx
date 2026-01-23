"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { FileText, Calendar, Hash, Upload, X, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h3 className=" font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    Registro de Documento
                </h3>
                <p className="text-sm text-muted-foreground">
                    Ingrese la información relacionada al DTE y adjunte el respaldo legal.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Folio y Fecha */}
                <Card className="border-2 rounded-3xl shadow-sm border-muted/20 overflow-hidden bg-card">
                    <CardContent className="p-10 space-y-8">
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-[0.1em] flex items-center gap-2">
                                <Hash className="h-3.5 w-3.5" />
                                Número de Folio (DTE)
                                {!formData.is_pending && <span className="text-rose-500 ml-1 font-black">*</span>}
                            </Label>
                            <Input
                                placeholder="Ej: 1450"
                                className="h-16 font-black text-2xl tabular-nums rounded-2xl border-2 transition-all focus:ring-primary/20 hover:border-primary/50 uppercase"
                                value={formData.document_number}
                                onChange={(e) => setField('document_number', e.target.value)}
                                disabled={formData.is_pending}
                            />
                        </div>

                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-[0.1em] flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                Fecha de Documento
                            </Label>
                            <Input
                                type="date"
                                className="h-16 font-black text-xl bg-background border-2 rounded-2xl transition-all focus:ring-primary/20 hover:border-primary/50 tabular-nums uppercase"
                                value={formData.document_date}
                                onChange={(e) => setField('document_date', e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Adjunto y Estado */}
                <div className="space-y-6">
                    <div className="space-y-4 p-8 bg-card border-2 rounded-3xl shadow-sm border-muted/20">
                        <Label className="text-xs font-black uppercase text-muted-foreground tracking-[0.1em] flex items-center gap-2">
                            <Upload className="h-3.5 w-3.5" />
                            Archivo PDF/XML Oficial
                            {isCreditNote && !formData.is_pending && <span className="text-rose-500 font-black ml-1 uppercase text-[8px] tracking-tight border-b-2 border-rose-500/20 pb-0.5">Obligatorio</span>}
                        </Label>
                        {!formData.attachment ? (
                            <div className="relative group">
                                <Input
                                    type="file"
                                    accept=".pdf,.xml"
                                    className="h-36 cursor-pointer opacity-0 absolute inset-0 z-10"
                                    onChange={(e) => setField('attachment', e.target.files?.[0] || null)}
                                />
                                <div className="h-36 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center bg-muted/5 transition-all group-hover:bg-primary/5 group-hover:border-primary/40">
                                    <div className="p-4 bg-background rounded-full mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                        <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <p className="text-[10px] font-black text-muted-foreground tracking-[0.15em] uppercase">Adjuntar Respaldo</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-6 bg-emerald-500/5 border-2 border-emerald-500/20 rounded-2xl animate-in zoom-in duration-300">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-600 shadow-sm">
                                        <FileText className="h-7 w-7" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-black truncate max-w-[200px] text-emerald-900 tracking-tight leading-none mb-1">{formData.attachment.name}</span>
                                        <span className="text-[10px] uppercase font-black text-emerald-600/60 tabular-nums">{(formData.attachment.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                </div>
                                <Button size="icon" variant="ghost" className="h-12 w-12 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors" onClick={() => setField('attachment', null)}>
                                    <X className="h-6 w-6" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="p-8 bg-amber-500/5 border-2 border-amber-500/10 rounded-3xl flex items-start gap-5 shadow-sm">
                        <Checkbox
                            id="is_pending"
                            checked={formData.is_pending}
                            onCheckedChange={(val) => {
                                setField('is_pending', !!val)
                                if (val) setField('document_number', '')
                            }}
                            className="h-7 w-7 rounded-lg border-2 border-amber-500/30 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 mt-0.5 transition-all shadow-sm"
                        />
                        <div className="space-y-1.5 leading-tight">
                            <Label htmlFor="is_pending" className="text-sm font-black text-amber-900 cursor-pointer uppercase tracking-tight flex items-center gap-2">
                                <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                                Diferir Registro Oficial
                            </Label>
                            <p className="text-[11px] font-bold text-amber-800/70 leading-relaxed max-w-sm">
                                Marque si aún no cuenta con el DTE definitivo. El asiento se creará en estado <strong>BORRADOR</strong>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

