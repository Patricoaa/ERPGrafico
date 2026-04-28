"use client"

import { useState } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { LabeledSelect, LabeledInput } from "@/components/shared"
import { AlertCircle, Loader2 } from "lucide-react"

interface ExclusionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (reason: string, notes: string) => Promise<void>
    title?: string
}

export function ExclusionModal({
    open,
    onOpenChange,
    onConfirm,
    title = "Excluir Movimiento"
}: ExclusionModalProps) {
    const [reason, setReason] = useState("DUPLICATE")
    const [notes, setNotes] = useState("")
    const [loading, setLoading] = useState(false)

    const handleConfirm = async () => {
        setLoading(true)
        try {
            await onConfirm(reason, notes)
            onOpenChange(false)
            // Reset fields
            setReason("DUPLICATE")
            setNotes("")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xs"
            title={
                <div className="flex items-center gap-3 py-1">
                    <div className="p-2 rounded-full bg-destructive/10 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <span className="text-lg font-black uppercase tracking-tight">{title}</span>
                </div>
            }
            footer={
                <div className="flex gap-2 w-full justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="text-xs font-bold uppercase">
                        Cancelar
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={handleConfirm} 
                        disabled={loading || !reason}
                        className="font-black uppercase tracking-widest px-6 text-xs"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Exclusión"}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 py-4">
                <p className="text-xs font-bold text-muted-foreground uppercase leading-relaxed opacity-80">
                    El movimiento se ocultará de la conciliación activa. La justificación es obligatoria para fines de auditoría.
                </p>
                
                <LabeledSelect
                    label="Motivo de Exclusión"
                    value={reason}
                    onChange={setReason}
                    className="font-bold uppercase text-xs"
                    options={[
                        { value: "DUPLICATE", label: "Transacción Duplicada" },
                        { value: "INTERNAL", label: "Traspaso Interno" },
                        { value: "ADJUSTMENT", label: "Ajuste de Saldo" },
                        { value: "ERROR", label: "Error de Importación" },
                        { value: "OTHER", label: "Otro (Especificar)" },
                    ]}
                />
                
                <LabeledInput
                    label="Notas Adicionales"
                    as="textarea"
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Detalla por qué excluyes este movimiento..."
                    className="text-xs font-medium"
                />
            </div>
        </BaseModal>
    )
}
