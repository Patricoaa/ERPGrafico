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
    const [contact, setContact] = useState<any>(null)
    const [deliveryDateTime, setDeliveryDateTime] = useState("")
    const [description, setDescription] = useState("")
    const [productDescription, setProductDescription] = useState("")
    const [customValues, setCustomValues] = useState<Record<string, any>>({})

    useEffect(() => {
        if (open && product) {
            setDesignNeeded(false)
            setContact(null)

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
            setProductDescription("")
            setCustomValues({})
        }
    }, [open, product])

    const handleConfirm = () => {
        onConfirm({
            design_needed: designNeeded,
            contact: contact ? { id: contact.id, name: contact.name } : null,
            delivery_date: deliveryDateTime,
            description,
            product_description: productDescription,
            custom_values: customValues
        })
        onOpenChange(false)
    }

    if (!product) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] border-primary/20 shadow-2xl overflow-y-auto max-h-[90vh]">
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
                    {/* Always visible: Delivery Date-Time and Contact Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
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

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Contacto / Referencia</Label>
                            {contact ? (
                                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <User className="h-4 w-4 text-primary shrink-0" />
                                        <span className="text-sm truncate font-medium">{contact.name}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={() => setContact(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <AdvancedContactSelector
                                    onSelectContact={setContact}
                                    onChange={() => { }}
                                    placeholder="Buscar contacto..."
                                />
                            )}
                        </div>
                    </div>

                    {/* Conditional: Workflow and Product Description */}
                    {product.requires_advanced_manufacturing && (
                        <>
                            <div className="space-y-2 pt-2 border-t font-medium text-xs text-primary flex items-center gap-2 uppercase tracking-wider">
                                <FileText className="h-3 w-3" /> Descripción del Trabajo
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Descripción del Producto</Label>
                                <Input
                                    placeholder="Ej: Trípticos 10x21cm, Papel Couche 170gr..."
                                    className="h-10"
                                    value={productDescription}
                                    onChange={(e) => setProductDescription(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Pre-Press Column */}
                                <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                                        <Paintbrush className="h-3 w-3" /> Pre-Impresión
                                    </h4>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium">Diseño Requerido</Label>
                                        <div className="flex gap-2">
                                            <Button
                                                variant={designNeeded ? "default" : "outline"}
                                                size="sm"
                                                className="flex-1 h-8 text-xs"
                                                onClick={() => setDesignNeeded(true)}>
                                                Sí
                                            </Button>
                                            <Button
                                                variant={!designNeeded ? "default" : "outline"}
                                                size="sm"
                                                className="flex-1 h-8 text-xs"
                                                onClick={() => setDesignNeeded(false)}>
                                                No
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Especificaciones</Label>
                                        <Input
                                            placeholder="Detalles técnicos..."
                                            className="h-8 text-xs bg-background"
                                            value={customValues.specs || ""}
                                            onChange={(e) => setCustomValues({ ...customValues, specs: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Folio</Label>
                                        <Input
                                            placeholder="N° Folio..."
                                            className="h-8 text-xs bg-background"
                                            value={customValues.folio || ""}
                                            onChange={(e) => setCustomValues({ ...customValues, folio: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Press Column */}
                                <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                                        <Plus className="h-3 w-3" /> Impresión
                                    </h4>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium">Tipo de Impresión</Label>
                                        <div className="flex gap-1">
                                            <Button
                                                variant={customValues.print_type === 'offset' ? "default" : "outline"}
                                                size="sm"
                                                className="flex-1 h-8 text-[10px]"
                                                onClick={() => setCustomValues({ ...customValues, print_type: 'offset' })}>
                                                Offset
                                            </Button>
                                            <Button
                                                variant={customValues.print_type === 'digital' ? "default" : "outline"}
                                                size="sm"
                                                className="flex-1 h-8 text-[10px]"
                                                onClick={() => setCustomValues({ ...customValues, print_type: 'digital' })}>
                                                Digital
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Post-Press Column */}
                                <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                                        <FileText className="h-3 w-3" /> Post-Impresión
                                    </h4>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Acabados</Label>
                                        <Input
                                            placeholder="Barniz, laminado, etc..."
                                            className="h-8 text-xs bg-background"
                                            value={customValues.finishing || ""}
                                            onChange={(e) => setCustomValues({ ...customValues, finishing: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="space-y-2 border-t pt-4">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Instrucciones / Observaciones Internas</Label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Textarea
                                placeholder="Notas internas para producción..."
                                className="pl-9 min-h-[80px]"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="bg-muted/10 p-4 -m-6 mt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button className="px-8 font-bold" onClick={handleConfirm}>Confirmar Detalles</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
