"use client"

import { useState, useImperativeHandle, forwardRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, FileCheck, Calendar, Hash, ArrowRight, Upload, X } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"

interface Step3_RegistrationProps {
    workflow: any
    onSuccess: (updatedWorkflow: any) => void
}

export const Step3_Registration = forwardRef(({
    workflow,
    onSuccess
}: Step3_RegistrationProps, ref) => {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        document_number: "",
        document_date: new Date().toISOString().split('T')[0],
        is_pending: false
    })
    const [attachment, setAttachment] = useState<File | null>(null)

    const isNC = workflow.is_credit_note

    useImperativeHandle(ref, () => ({
        submit: handleSubmit,
        loading
    }))

    const handleSubmit = async () => {
        if (!formData.document_number) {
            toast.error("El número de folio es obligatorio.")
            return
        }

        // Mandatory attachment for issued NC (Sale) or received NC (Purchase) if not pending
        if (isNC && !formData.is_pending && !attachment) {
            toast.error("El archivo PDF/XML es obligatorio para oficializar la nota de crédito.")
            return
        }

        try {
            setLoading(true)
            const data = new FormData()
            data.append('document_number', formData.document_number)
            data.append('document_date', formData.document_date)
            data.append('is_pending', formData.is_pending.toString())
            if (attachment) {
                data.append('document_attachment', attachment)
            }

            const res = await api.post(`/billing/note-workflows/${workflow.id}/register-document/`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            onSuccess(res.data)
        } catch (error: any) {
            console.error("Error registering document:", error)
            toast.error(error.response?.data?.error || "Error al registrar el documento.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <FileCheck className="h-7 w-7 text-primary" />
                    Registro de Documento
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                    Ingrese la información oficial del DTE y adjunte el respaldo legal.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Folio y Fecha */}
                <Card className="border-2 rounded-2xl shadow-sm border-muted/20 overflow-hidden bg-card">
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                                <Hash className="h-3 w-3" />
                                Número de Folio (DTE)
                            </Label>
                            <Input
                                placeholder="Ej: 1450"
                                className="h-14 font-black text-xl tabular-nums rounded-xl border-2 transition-all focus:ring-primary hover:border-primary/50"
                                value={formData.document_number}
                                onChange={(e) => setFormData(p => ({ ...p, document_number: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                Fecha de Documento
                            </Label>
                            <Input
                                type="date"
                                className="h-14 font-bold bg-background border-2 rounded-xl transition-all focus:ring-primary hover:border-primary/50 tabular-nums"
                                value={formData.document_date}
                                onChange={(e) => setFormData(p => ({ ...p, document_date: e.target.value }))}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Adjunto y Estado */}
                <div className="space-y-6">
                    <div className="space-y-4 p-6 bg-card border-2 rounded-2xl shadow-sm border-muted/20">
                        <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                            <Upload className="h-3 w-3" />
                            Documento PDF/XML Oficial
                            {isNC && !formData.is_pending && <span className="text-rose-500 font-black ml-1">* REQUERIDO</span>}
                        </Label>
                        {!attachment ? (
                            <div className="relative group">
                                <Input
                                    type="file"
                                    accept=".pdf,.xml"
                                    className="h-32 cursor-pointer opacity-0 absolute inset-0 z-10"
                                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                                />
                                <div className="h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-muted/5 transition-all group-hover:bg-primary/5 group-hover:border-primary/40">
                                    <Upload className="h-6 w-6 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
                                    <p className="text-xs font-black text-muted-foreground tracking-tight uppercase">Adjuntar Respaldo</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-5 bg-emerald-500/5 border-2 border-emerald-500/20 rounded-xl animate-in zoom-in duration-300">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600">
                                        <FileCheck className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black truncate max-w-[150px] text-emerald-900 tracking-tight">{attachment.name}</span>
                                        <span className="text-[10px] uppercase font-black text-emerald-600/60 tabular-nums">{(attachment.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                </div>
                                <Button size="icon" variant="ghost" className="h-10 w-10 text-rose-500 hover:bg-rose-500/10 rounded-full" onClick={() => setAttachment(null)}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-amber-500/5 border-2 border-amber-500/10 rounded-2xl flex items-start gap-4">
                        <Checkbox
                            id="is_pending"
                            checked={formData.is_pending}
                            onCheckedChange={(val) => setFormData(p => ({ ...p, is_pending: !!val }))}
                            className="h-6 w-6 rounded-lg border-2 border-amber-500/30 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 mt-0.5"
                        />
                        <div className="space-y-1 leading-tight">
                            <Label htmlFor="is_pending" className="text-sm font-black text-amber-900 cursor-pointer uppercase tracking-tight">
                                Diferir Registro Contable
                            </Label>
                            <p className="text-[11px] font-medium text-amber-800/70 leading-relaxed">
                                El asiento se creará en <strong>BORRADOR</strong>. Marque si aún no cuenta con el folio definitivo.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
})

Step3_Registration.displayName = "Step3_Registration"
