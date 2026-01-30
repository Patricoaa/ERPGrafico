"use client"

import { useState } from "react"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
    CalendarIcon,
    User,
    FileText,
    MessageSquare,
    Send,
    History
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CommentSystem } from "@/components/shared/CommentSystem"

interface Comment {
    user: string
    text: string
    timestamp: string
}

interface WizardRightSidebarProps {
    order: any
    viewingStepIndex: number
    productName: string
    stageData: any
    onAddComment: (text: string) => void
    comments: Comment[]
}

export function WizardRightSidebar({
    order,
    viewingStepIndex,
    productName,
    stageData,
    onAddComment,
    comments = []
}: WizardRightSidebarProps) {
    const techSpecs = [
        { label: "Pre-Impresión", value: stageData?.prepress_specs || order?.specifications_prepress },
        { label: "Impresión", value: stageData?.press_specs || order?.specifications_press },
        { label: "Post-Impresión", value: stageData?.postpress_specs || order?.specifications_postpress },
        { label: "General", value: order?.specifications }
    ].filter(s => s.value)

    return (
        <div className="w-80 border-l bg-muted/5 flex flex-col h-full max-h-full overflow-hidden hidden lg:flex shrink-0">
            <ScrollArea className="flex-1 w-full h-full max-h-full">
                <Accordion type="multiple" defaultValue={["info", "specs", "comments"]} className="w-full p-4 space-y-4">
                    {/* General Info */}
                    <AccordionItem value="info" className="border-none">
                        <AccordionTrigger className="text-xs font-bold uppercase text-muted-foreground hover:no-underline py-2">
                            Información General
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
                                            <p className="text-sm font-medium">
                                                {new Date(order.start_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {order?.sale_order_delivery_date && (
                                    <div className="p-3 space-y-1">
                                        <p className="font-bold text-[10px] uppercase text-muted-foreground">Fecha de Entrega</p>
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                                            <p className="text-sm font-medium">
                                                {new Date(order.sale_order_delivery_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {(stageData?.contact_name || order?.sale_customer_name) && (
                                    <div className="p-3 space-y-1">
                                        <p className="font-bold text-[10px] uppercase text-muted-foreground">
                                            Contacto Relacionado
                                        </p>
                                        <div className="flex items-start gap-3 pt-0.5">
                                            <div className="bg-muted p-1.5 rounded-full mt-0.5">
                                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-sm font-semibold truncate leading-tight">
                                                    {stageData?.contact_name || order?.sale_customer_name}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground truncate">
                                                    {stageData?.contact_tax_id || order?.sale_customer_rut}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Technical Specs */}
                    <AccordionItem value="specs" className="border-none">
                        <AccordionTrigger className="text-xs font-bold uppercase text-muted-foreground hover:no-underline py-2">
                            Especificaciones Técnicas
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                            <div className="space-y-3">
                                {techSpecs.length > 0 ? techSpecs.map((spec, i) => (
                                    <div key={i} className="bg-background rounded-lg border p-3 space-y-1">
                                        <p className="font-bold text-[10px] uppercase text-muted-foreground flex items-center gap-1.5">
                                            <FileText className="h-3 w-3" />
                                            {spec.label}
                                        </p>
                                        <p className="text-xs whitespace-pre-wrap">{spec.value}</p>
                                    </div>
                                )) : (
                                    <p className="text-xs text-muted-foreground italic text-center py-4">Sin especificaciones técnicas</p>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Internal Observations / Comments */}
                    <AccordionItem value="comments" className="border-none">
                        <AccordionTrigger className="text-xs font-bold uppercase text-muted-foreground hover:no-underline py-2">
                            Observaciones Internas
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                            <CommentSystem
                                comments={comments}
                                onAddComment={onAddComment}
                                placeholder="Agregar observación interna..."
                                emptyMessage="No hay observaciones aún"
                                maxHeight="none"
                            />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </ScrollArea>
        </div>
    )
}
