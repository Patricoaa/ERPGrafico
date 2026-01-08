"use client"

import { useState, useEffect } from "react"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    CalendarIcon, User, Paintbrush, FileText, Plus, X, Clock
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"

interface AdvancedManufacturingDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: any
    onConfirm: (data: any) => void
}

export function AdvancedManufacturingDialog({
    open, onOpenChange, product, onConfirm
}: AdvancedManufacturingDialogProps) {
    const [designNeeded, setDesignNeeded] = useState(false)
    const [contacts, setContacts] = useState<any[]>([]) // Changed to support object contacts
    const [deliveryDateTime, setDeliveryDateTime] = useState("")
    const [description, setDescription] = useState("")
    const [customValues, setCustomValues] = useState<Record<string, any>>({})

    useEffect(() => {
        if (open && product) {
            setDesignNeeded(false)
            setContacts([])

            // Set default delivery date-time
            const daysOffset = product.mfg_default_delivery_days ?? 3
            const defaultDate = addDays(new Date(), daysOffset)
            // Set time to standard end of day 18:00
            defaultDate.setHours(18, 0, 0, 0)

            // Format for datetime-local input: YYYY-MM-DDTHH:mm
            try {
                const year = defaultDate.getFullYear()
                const month = String(defaultDate.getMonth() + 1).padStart(2, '0')
                const day = String(defaultDate.getDate()).padStart(2, '0')
                const hours = String(defaultDate.getHours()).padStart(2, '0')
                const minutes = String(defaultDate.getMinutes()).padStart(2, '0')
                setDeliveryDateTime(`${year}-${month}-${day}T${hours}:${minutes}`)
            } catch (e) {
                console.error("Error setting default date", e)
            }

            setDescription("")
            setCustomValues({})
        }
    }, [open, product])

    const handleAddContact = (contact: any) => {
        if (contact && !contacts.some(c => c.id === contact.id)) {
            setContacts([...contacts, contact])
        }
    }

    const handleRemoveContact = (id: number) => {
        setContacts(contacts.filter(c => c.id !== id))
    }

    const handleConfirm = () => {
        onConfirm({
            design_needed: designNeeded,
            contacts: contacts.map(c => ({ id: c.id, name: c.name })),
            delivery_date: deliveryDateTime, // Sending the full date-time string
            description,
            custom_values: customValues
        })
        onOpenChange(false)
    }

    if (!product) return null

    const showDesign = product.mfg_show_design_needed ?? true
    const showContacts = product.mfg_show_contacts ?? true

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] border-primary/20 shadow-2xl">
                <DialogHeader className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                            <Paintbrush className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Detalles de Fabricación</DialogTitle>
                            <p className="text-sm text-muted-foreground">{product.name} ({product.code})</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        {showDesign && (
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Necesidad de Diseño</Label>
                                <div className="flex gap-2">
                                    <Button
                                        variant={designNeeded ? "default" : "outline"}
                                        className="flex-1"
                                        onClick={() => setDesignNeeded(true)}
                                    >
                                        Sí
                                    </Button>
                                    <Button
                                        variant={!designNeeded ? "default" : "outline"}
                                        className="flex-1"
                                        onClick={() => setDesignNeeded(false)}
                                    >
                                        No
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className={cn("space-y-2", !showDesign && "col-span-2")}>
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Fecha y Hora de Entrega</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    type="datetime-local"
                                    className="pl-9 h-10"
                                    value={deliveryDateTime}
                                    onChange={(e) => setDeliveryDateTime(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {showContacts && (
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Contactos Asociados / Referencias</Label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <AdvancedContactSelector
                                        onSelectContact={handleAddContact}
                                        onChange={() => { }}
                                        placeholder="Buscar contacto del sistema..."
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg bg-muted/30 border border-dashed">
                                {contacts.length === 0 && (
                                    <span className="text-[10px] text-muted-foreground italic flex items-center px-2">Sin contactos asociados</span>
                                )}
                                {contacts.map((contact) => (
                                    <Badge key={contact.id} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                                        {contact.name}
                                        <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveContact(contact.id)} />
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Instrucciones / Observaciones</Label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Textarea
                                placeholder="Describa requerimientos técnicos, acabados, etc."
                                className="pl-9 min-h-[100px]"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="bg-muted/10 p-4 -m-6 mt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button className="px-8 font-bold" onClick={handleConfirm}>Continuar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
