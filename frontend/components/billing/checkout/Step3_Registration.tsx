"use client"

import { useState } from "react"
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

export function Step3_Registration({
    workflow,
    onSuccess
}: Step3_RegistrationProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        document_number: "",
        document_date: new Date().toISOString().split('T')[0],
        is_pending: false
    })
    const [attachment, setAttachment] = useState<File | null>(null)

    const handleSubmit = async () => {
        if (!formData.document_number) {
            toast.error("El número de folio es obligatorio.")
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
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2">
                <h3 className="text-xl font-black flex items-center gap-2">
                    <FileCheck className="h-6 w-6 text-primary" />
                    Registro Legal y Contable
                </h3>
                <p className="text-muted-foreground text-sm">
                    Ingrese el folio oficial emitido por el SII y adjunte el documento PDF.
                </p>
            </div>

            <Card className="border-2 border-primary/10 shadow-lg overflow-hidden">
                <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Folio Number */}
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                                <Hash className="h-3 w-3" />
                                Número de Folio (DTE)
                            </Label>
                            <Input
                                placeholder="Ej: 1450"
                                className="h-12 font-black text-lg bg-muted/20 border-2 border-primary/20 focus:border-primary transition-all"
                                value={formData.document_number}
                                onChange={(e) => setFormData(p => ({ ...p, document_number: e.target.value }))}
                            />
                        </div>

                        {/* Document Date */}
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                Fecha de Emisión
                            </Label>
                            <Input
                                type="date"
                                className="h-12 font-bold bg-muted/20 border-2"
                                value={formData.document_date}
                                onChange={(e) => setFormData(p => ({ ...p, document_date: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* File Attachment */}
                    <div className="space-y-3">
                        <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                            <Upload className="h-3 w-3" />
                            Documento Adjunto (PDF/XML)
                        </Label>
                        <div className="flex items-center gap-4">
                            {!attachment ? (
                                <div className="flex-1 relative">
                                    <Input
                                        type="file"
                                        accept=".pdf,.xml"
                                        className="h-24 cursor-pointer opacity-0 absolute inset-0 z-10"
                                        onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                                    />
                                    <div className="h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-muted/5 transition-colors hover:bg-muted/10 hover:border-primary/30">
                                        <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                                        <p className="text-xs font-bold text-muted-foreground">Arrastre o seleccione archivo</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-between p-4 bg-primary/5 border-2 border-primary/20 rounded-xl animate-in zoom-in duration-300">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                            <FileCheck className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold truncate max-w-[200px]">{attachment.name}</span>
                                            <span className="text-[10px] uppercase font-black opacity-50">{(attachment.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setAttachment(null)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Options */}
                    <div className="pt-2 flex items-center space-x-2">
                        <Checkbox
                            id="is_pending"
                            checked={formData.is_pending}
                            onCheckedChange={(val) => setFormData(p => ({ ...p, is_pending: !!val }))}
                        />
                        <Label htmlFor="is_pending" className="text-sm font-medium cursor-pointer">
                            Diferir publicación contable (Borrador)
                        </Label>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end pt-6">
                <Button
                    onClick={handleSubmit}
                    disabled={loading || !formData.document_number}
                    className="group px-10 py-7 rounded-2xl font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-primary/20"
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                            Registrando...
                        </>
                    ) : (
                        <>
                            Registrar Documento
                            <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
