"use client"

import { showApiError } from "@/lib/errors"
import React, { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { Trash2, Plus, Users, Calculator, Info } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface InitialCapitalModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

interface PartnerEntry {
    contact_id: number
    name: string
    amount: number
}

export function InitialCapitalModal({ open, onOpenChange, onSuccess }: InitialCapitalModalProps) {
    const [entries, setEntries] = useState<PartnerEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [totalCapital, setTotalCapital] = useState(0)

    useEffect(() => {
        const total = entries.reduce((acc, curr) => acc + curr.amount, 0)
        setTotalCapital(total)
    }, [entries])

    const handleAddPartner = (contactId: string | null, contact?: any) => {
        if (!contactId) return
        
        const id = parseInt(contactId)
        if (entries.some(e => e.contact_id === id)) {
            toast.error("Este socio ya ha sido agregado a la lista.")
            return
        }

        setEntries([...entries, { contact_id: id, name: contact?.name || `Contacto #${id}`, amount: 0 }])
    }

    const handleUpdateAmount = (index: number, amount: string) => {
        const value = parseFloat(amount) || 0
        const newEntries = [...entries]
        newEntries[index].amount = value
        setEntries(newEntries)
    }

    const handleRemovePartner = (index: number) => {
        const newEntries = [...entries]
        newEntries.splice(index, 1)
        setEntries(newEntries)
    }

    const handleSubmit = async () => {
        if (entries.length === 0) {
            toast.error("Debe agregar al menos un socio.")
            return
        }

        if (entries.some(e => e.amount <= 0)) {
            toast.error("Todos los montos deben ser mayores a cero.")
            return
        }

        setLoading(true)
        try {
            await partnersApi.initialSetup(entries.map(e => ({
                contact_id: e.contact_id,
                amount: e.amount
            })))
            toast.success("Configuración inicial de capital completada con éxito.")
            onSuccess()
            onOpenChange(false)
            setEntries([])
        } catch (error: unknown) {
            showApiError(error, "Error al procesar la configuración inicial")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Users className="h-5 w-5" />
                        <DialogTitle>Configuración Inicial de Capital</DialogTitle>
                    </div>
                    <DialogDescription>
                        Defina los socios iniciales y sus aportes para establecer la estructura de capital de la empresa en marcha.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <Alert variant="default" className="bg-blue-50/50 border-blue-200">
                        <Info className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-blue-800 text-xs font-bold uppercase tracking-wider">Aviso Contable</AlertTitle>
                        <AlertDescription className="text-primary text-xs">
                            Esta acción generará un asiento de **Suscripción de Capital**, debitando la cuenta de **Capital por Cobrar Socios** (Activo) y acreditando la cuenta de **Capital Social** (Patrimonio), manteniendo la trazabilidad individual por socio.
                            Los aportes físicos de bienes se deben registrar posteriormente.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                        <div className="flex items-end gap-3">
                            <div className="flex-1 space-y-2">
                                <Label>Agregar Socio</Label>
                                <AdvancedContactSelector
                                    value={null}
                                    onChange={(val) => {}}
                                    onSelectContact={(contact) => handleAddPartner(contact.id.toString(), contact)}
                                    placeholder="Buscar contacto por nombre o RUT..."
                                />
                            </div>
                        </div>

                        <div className="border rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="p-3 text-left font-semibold text-muted-foreground">Socio</th>
                                        <th className="p-3 text-right font-semibold text-muted-foreground w-1/3">Monto Aportado</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground w-20">Participación</th>
                                        <th className="p-3 text-center font-semibold text-muted-foreground w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {entries.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-muted-foreground italic">
                                                No hay socios agregados. Use el buscador superior.
                                            </td>
                                        </tr>
                                    ) : (
                                        entries.map((entry, index) => {
                                            const percentage = totalCapital > 0 ? (entry.amount / totalCapital) * 100 : 0
                                            return (
                                                <tr key={entry.contact_id} className="hover:bg-muted/20 transition-colors">
                                                    <td className="p-3 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                                #{index + 1}
                                                            </div>
                                                            {entry.name}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                                                            <Input
                                                                type="number"
                                                                value={entry.amount || ""}
                                                                onChange={(e) => handleUpdateAmount(index, e.target.value)}
                                                                className="pl-7 text-right font-mono"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary font-bold text-xs">
                                                            {percentage.toFixed(2)}%
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                                            onClick={() => handleRemovePartner(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                                {entries.length > 0 && (
                                    <tfoot className="bg-muted/30 font-bold border-t">
                                        <tr>
                                            <td className="p-4 text-right">TOTAL CAPITAL SUSCRITO</td>
                                            <td className="p-4 text-right text-lg text-primary font-mono">
                                                {formatCurrency(totalCapital)}
                                            </td>
                                            <td className="p-4 text-center">100%</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={loading || entries.length === 0}
                        className="gap-2"
                    >
                        {loading ? "Procesando..." : "Guardar y Generar Asiento"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
