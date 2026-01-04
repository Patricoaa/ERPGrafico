"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Loader2, Save } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

interface DocumentEditModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    document: any
    onSuccess?: () => void
}

export function DocumentEditModal({
    open,
    onOpenChange,
    document,
    onSuccess
}: DocumentEditModalProps) {
    const [number, setNumber] = useState("")
    const [date, setDate] = useState("")
    const [attachment, setAttachment] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (document) {
            setNumber(document.number || "")
            if (document.date) {
                setDate(new Date(document.date).toISOString().split('T')[0])
            }
        }
    }, [document])

    const handleSubmit = async () => {
        if (!number) {
            toast.error("El número de documento es obligatorio")
            return
        }

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('number', number)
            formData.append('date', date)
            if (attachment) {
                formData.append('document_attachment', attachment)
            }

            await api.patch(`/billing/invoices/${document.id}/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })

            toast.success("Documento actualizado correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: any) {
            console.error("Error updating document:", error)
            toast.error(error.response?.data?.error || "Error al actualizar el documento")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-5 w-5 text-orange-500" />
                        Editar Documento
                    </DialogTitle>
                    <DialogDescription>
                        Actualice la información básica del documento {document?.dte_type_display}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-number">Número / Folio</Label>
                        <Input
                            id="edit-number"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            placeholder="Ej: 12345"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-date">Fecha de Emisión</Label>
                        <Input
                            id="edit-date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-attachment">Adjunto (Factura/Boleta)</Label>
                        <Input
                            id="edit-attachment"
                            type="file"
                            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                            className="cursor-pointer"
                        />
                        {document?.document_attachment && (
                            <p className="text-[10px] text-muted-foreground">
                                Ya existe un archivo cargado. Seleccione uno nuevo para reemplazarlo.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Cambios
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
