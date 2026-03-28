"use client"

import React, { useEffect, useState } from "react"
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { toast } from "sonner"
import { 
    Info,
    Loader2, 
    ArrowRightLeft, 
    TrendingUp 
} from "lucide-react"

interface ModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function SubscriptionMovementModal({ open, onOpenChange, onSuccess }: ModalProps) {
    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<any[]>([])
    const [formData, setFormData] = useState({
        contact_id: "",
        amount: "",
        type: "SUBSCRIPTION" as "SUBSCRIPTION" | "REDUCTION",
        date: new Date().toISOString().split('T')[0],
        description: ""
    })

    useEffect(() => {
        if (open) {
            partnersApi.getPartners().then(setPartners)
        }
    }, [open])

    const handleSubmit = async () => {
        if (!formData.contact_id || !formData.amount) {
            toast.error("Debe completar todos los campos obligatorios.")
            return
        }

        setLoading(true)
        try {
            await partnersApi.recordSubscription({
                contact_id: parseInt(formData.contact_id),
                amount: parseFloat(formData.amount),
                type: formData.type,
                date: formData.date,
                description: formData.description
            })
            toast.success("Movimiento de capital registrado exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al registrar suscripción")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Aumento / Reducción de Capital
                    </DialogTitle>
                    <DialogDescription>
                        Registre un cambio formal en la participación societaria. Esto afecta el capital <strong>suscrito</strong> y el saldo por enterar del socio.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="partner">Socio</Label>
                        <Select 
                            value={formData.contact_id} 
                            onValueChange={(v) => setFormData(prev => ({ ...prev, contact_id: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione un socio" />
                            </SelectTrigger>
                            <SelectContent>
                                {partners.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="type">Tipo de Movimiento</Label>
                        <Select 
                            value={formData.type} 
                            onValueChange={(v: any) => setFormData(prev => ({ ...prev, type: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="SUBSCRIPTION">Aumento de Capital (Suscripción)</SelectItem>
                                <SelectItem value="REDUCTION">Reducción de Capital</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Monto ($)</Label>
                        <Input 
                            id="amount" 
                            type="number" 
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="date">Fecha</Label>
                        <Input 
                            id="date" 
                            type="date" 
                            value={formData.date}
                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Descripción / Motivo</Label>
                        <Input 
                            id="description" 
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ej: Aporte por expansión 2026"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Confirmar Movimiento
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function EquityTransferModal({ open, onOpenChange, onSuccess }: ModalProps) {
    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<any[]>([])
    const [formData, setFormData] = useState({
        from_contact_id: "",
        to_contact_id: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        description: ""
    })

    useEffect(() => {
        if (open) {
            partnersApi.getPartners().then(setPartners)
        }
    }, [open])

    const handleSubmit = async () => {
        if (!formData.from_contact_id || !formData.to_contact_id || !formData.amount) {
            toast.error("Debe completar todos los campos obligatorios.")
            return
        }

        if (formData.from_contact_id === formData.to_contact_id) {
            toast.error("El socio de origen y destino no pueden ser el mismo.")
            return
        }

        setLoading(true)
        try {
            await partnersApi.recordTransfer({
                from_contact_id: parseInt(formData.from_contact_id),
                to_contact_id: parseInt(formData.to_contact_id),
                amount: parseFloat(formData.amount),
                date: formData.date,
                description: formData.description
            })
            toast.success("Transferencia de participación registrada exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al registrar transferencia")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                        Transferencia de Participación
                    </DialogTitle>
                    <DialogDescription>
                        Mueva capital suscrito de un socio existente a otro nuevo o actual.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Socio que Transfiere (Vende)</Label>
                        <Select 
                            value={formData.from_contact_id} 
                            onValueChange={(v) => setFormData(prev => ({ ...prev, from_contact_id: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Socio de origen" />
                            </SelectTrigger>
                            <SelectContent>
                                {partners.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2 font-bold text-center text-muted-foreground">
                        <ArrowRightLeft className="mx-auto h-4 w-4" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Socio que Recibe (Compra)</Label>
                        <Select 
                            value={formData.to_contact_id} 
                            onValueChange={(v) => setFormData(prev => ({ ...prev, to_contact_id: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Socio de destino" />
                            </SelectTrigger>
                            <SelectContent>
                                {partners.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Monto Capital Transferido ($)</Label>
                        <Input 
                            id="amount" 
                            type="number" 
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="date">Fecha de la Transacción</Label>
                        <Input 
                            id="date" 
                            type="date" 
                            value={formData.date}
                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Descripción / Motivo</Label>
                        <Input 
                            id="description" 
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ej: Venta de acciones según acta Nº 45"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Registrar Transferencia
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
