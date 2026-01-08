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
    CalendarIcon, User, Paintbrush, FileText, Plus, X
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
    Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

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
    const [contacts, setContacts] = useState<string[]>([])
    const [newContact, setNewContact] = useState("")
    const [deliveryDate, setDeliveryDate] = useState<Date>()
    const [description, setDescription] = useState("")
    const [customValues, setCustomValues] = useState<Record<string, any>>({})

    useEffect(() => {
        if (open) {
            setDesignNeeded(false)
            setContacts([])
            setDeliveryDate(undefined)
            setDescription("")
            setCustomValues({})
        }
    }, [open])

    const handleAddContact = () => {
        if (newContact.trim()) {
            setContacts([...contacts, newContact.trim()])
            setNewContact("")
        }
    }

    const handleRemoveContact = (index: number) => {
        setContacts(contacts.filter((_, i) => i !== index))
    }

    const handleConfirm = () => {
        onConfirm({
            design_needed: designNeeded,
            contacts,
            delivery_date: deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : null,
            description,
            custom_values: customValues
        })
        onOpenChange(false)
    }

    if (!product) return null

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

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Fecha Estimada Entrega</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !deliveryDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {deliveryDate ? format(deliveryDate, "PPP") : <span>Seleccionar fecha</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={deliveryDate}
                                        onSelect={setDeliveryDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Contactos Asociados / Referencias</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Nombre o ID de contacto"
                                    className="pl-9"
                                    value={newContact}
                                    onChange={(e) => setNewContact(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddContact()}
                                />
                            </div>
                            <Button variant="secondary" onClick={handleAddContact}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg bg-muted/30 border border-dashed">
                            {contacts.length === 0 && (
                                <span className="text-[10px] text-muted-foreground italic flex items-center px-2">Sin contactos asociados</span>
                            )}
                            {contacts.map((contact, i) => (
                                <Badge key={i} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                                    {contact}
                                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveContact(i)} />
                                </Badge>
                            ))}
                        </div>
                    </div>

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
