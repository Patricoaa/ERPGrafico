"use client"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
    Pencil,
    LayoutDashboard,
    Ban,
    Trash2,
    CalendarIcon,
    User,
} from "lucide-react"

interface WizardRightSidebarProps {
    order: any
    viewingStepIndex: number
    onEdit: () => void
    onOpenCommandCenter: (id: number, type: 'sale' | 'purchase') => void
    onAnnul: () => void
    onDelete: () => void
    isAnnuling: boolean
    isDeleting: boolean
    productName: string
    stageData: any
}

export function WizardRightSidebar({
    order,
    viewingStepIndex,
    onEdit,
    onOpenCommandCenter,
    onAnnul,
    onDelete,
    isAnnuling,
    isDeleting,
    productName,
    stageData
}: WizardRightSidebarProps) {

    const canEditOrDelete = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order?.current_stage)

    return (
        <div className="w-80 border-l bg-muted/5 p-4 space-y-4 overflow-y-auto hidden lg:block">
            <Accordion type="multiple" defaultValue={["actions", "info", "notes"]} className="w-full">
                <AccordionItem value="actions" className="border-none">
                    <AccordionTrigger className="text-xs font-bold uppercase text-muted-foreground hover:no-underline py-2">
                        Acciones
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <div className="flex flex-wrap gap-2">
                            {canEditOrDelete && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 gap-2 h-9"
                                    onClick={onEdit}
                                    title="Editar OT"
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-2 h-9"
                                onClick={() => order?.sale_order && onOpenCommandCenter(order.sale_order, 'sale')}
                                title="Configuración de Venta"
                            >
                                <LayoutDashboard className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-2 h-9 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={onAnnul}
                                disabled={isAnnuling || order?.status === 'CANCELLED' || order?.is_cancellable === false}
                                title={order?.is_cancellable === false ? "Anulación no permitida en esta etapa" : "Anular OT"}
                            >
                                <Ban className="h-4 w-4" />
                            </Button>
                            {canEditOrDelete && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 gap-2 h-9 text-destructive hover:bg-destructive/10"
                                    onClick={onDelete}
                                    disabled={isDeleting}
                                    title="Eliminar OT"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="info" className="border-none">
                    <AccordionTrigger className="text-xs font-bold uppercase text-muted-foreground hover:no-underline py-2">
                        Información del Trabajo
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <div className="bg-background rounded-lg border divide-y overflow-hidden">
                            <div className="p-3 space-y-1">
                                <p className="text-sm font-medium leading-tight">{productName}</p>
                                {order?.product_description && (
                                    <p className="text-xs text-muted-foreground italic line-clamp-2">{order.product_description}</p>
                                )}
                            </div>

                            {order?.start_date && (
                                <div className="p-3 space-y-1">
                                    <p className="font-bold text-[10px] uppercase text-muted-foreground">Fecha de Inicio</p>
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                                        <p className="text-sm font-medium">{new Date(order.start_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                    </div>
                                </div>
                            )}

                            {order?.sale_order_delivery_date && (
                                <div className="p-3 space-y-1">
                                    <p className="font-bold text-[10px] uppercase text-muted-foreground">Fecha de Entrega</p>
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                                        <p className="text-sm font-medium">{new Date(order.sale_order_delivery_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                    </div>
                                </div>
                            )}

                            {(stageData.contact_name || order?.sale_customer_name) && (
                                <div className="p-3 space-y-1">
                                    <p className="font-bold text-[10px] uppercase text-muted-foreground">
                                        {stageData.contact_name ? 'Contacto / Referencia' : 'Cliente Relacionado'}
                                    </p>
                                    <div className="flex items-start gap-3 pt-0.5">
                                        <div className="bg-muted p-1.5 rounded-full mt-0.5">
                                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-sm font-semibold truncate leading-tight">
                                                {stageData.contact_name || order.sale_customer_name}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground truncate">
                                                {stageData.contact_tax_id || order.sale_customer_rut}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {stageData.internal_notes && (
                    <AccordionItem value="notes" className="border-none">
                        <AccordionTrigger className="text-xs font-bold uppercase text-muted-foreground hover:no-underline py-2">
                            Observaciones Internas
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                            <div className="p-3 bg-background rounded-lg border">
                                <p className="text-xs whitespace-pre-wrap">{stageData.internal_notes}</p>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>
        </div>
    )
}
