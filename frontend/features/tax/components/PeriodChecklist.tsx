"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    CheckSquare,
    Square,
    FileCheck,
    ShieldCheck,
    AlertTriangle,
    Clock,
    UserCheck,
    ArrowRightCircle,
    Lock
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { BaseModal } from "@/components/shared/BaseModal"
import { TaxPeriod } from "../types"

interface PeriodChecklistProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    period: TaxPeriod
    onSuccess: () => void
}

export function PeriodChecklist({ isOpen, onOpenChange, period, onSuccess }: PeriodChecklistProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [checklist, setChecklist] = useState({
        invoices_reviewed: false,
        purchases_received: false,
        credit_notes_applied: false,
        reconciliation_done: false,
        declaration_filed: false
    })

    const isAllChecked = Object.values(checklist).every(v => v === true)

    const handleClosePeriod = async () => {
        if (!isAllChecked) {
            toast.error("Debe completar todos los puntos del checklist")
            return
        }

        setIsLoading(true)
        try {
            await api.post(`/tax/periods/${period.id}/close/`)
            toast.success("Período cerrado correctamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al cerrar el período")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <BaseModal
            open={isOpen}
            onOpenChange={onOpenChange}
            size="md"
            title={
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-warning/10 text-warning">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-xl font-bold">Cierre de Período Tributario</div>
                        <div className="text-muted-foreground text-sm font-normal">
                            {period?.month_display} {period?.year}
                        </div>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">
                        Aún no, cancelar
                    </Button>
                    <Button
                        onClick={handleClosePeriod}
                        disabled={!isAllChecked || isLoading}
                        className={cn(
                            "rounded-lg px-8 shadow-lg transition-all",
                            isAllChecked
                                ? "bg-warning hover:bg-warning/90 shadow-warning/20"
                                : "opacity-50"
                        )}
                    >
                        <Lock className="h-4 w-4 mr-2" />
                        Cerrar Período Definitivamente
                    </Button>
                </div>
            }
        >
            <div className="py-2 space-y-6">
                <div className="bg-warning/5 p-4 rounded-lg border border-warning/20 flex gap-4 items-start text-sm text-warning">
                    <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-warning" />
                    <p>
                        <span className="font-bold">¡Atención!</span> Cerrar un período bloqueará la edición de todos los documentos asociados (Ventas/Compras) para garantizar la consistencia contable y tributaria.
                    </p>
                </div>

                <div className="space-y-1">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Checklist de Verificación</h4>

                    <div className="space-y-1">
                        {[
                            { id: 'invoices_reviewed', label: 'Revisión y validación de Facturas/Boletas emitidas' },
                            { id: 'purchases_received', label: 'Aceptación de documentos de compra en RCV (SII)' },
                            { id: 'credit_notes_applied', label: 'Verificación de Notas de Crédito y Débito' },
                            { id: 'reconciliation_done', label: 'Conciliación bancaria de pagos tributarios' },
                            { id: 'declaration_filed', label: 'Declaración F29 aceptada en el portal SII' },
                        ].map((item) => (
                            <div
                                key={item.id}
                                className={cn(
                                    "flex items-center space-x-3 p-3 rounded-lg transition-all border border-transparent",
                                    checklist[item.id as keyof typeof checklist] ? "bg-success/5 border-success/20" : "hover:bg-muted/50"
                                )}
                            >
                                <Checkbox
                                    id={item.id}
                                    checked={checklist[item.id as keyof typeof checklist]}
                                    onCheckedChange={(checked) =>
                                        setChecklist({ ...checklist, [item.id]: !!checked })
                                    }
                                    className="h-5 w-5 rounded-md"
                                />
                                <label
                                    htmlFor={item.id}
                                    className={cn(
                                        "flex-1 text-sm font-medium cursor-pointer transition-all",
                                        checklist[item.id as keyof typeof checklist] ? "text-success" : "text-foreground"
                                    )}
                                >
                                    {item.label}
                                </label>
                                {checklist[item.id as keyof typeof checklist] && (
                                    <FileCheck className="h-4 w-4 text-success" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </BaseModal>
    )
}
