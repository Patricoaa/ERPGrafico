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
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"

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
    const [newComment, setNewComment] = useState("")

    const handleSendComment = () => {
        if (!newComment.trim()) return
        onAddComment(newComment.trim())
        setNewComment("")
    }

    const techSpecs = [
        { label: "Pre-Impresión", value: stageData?.prepress_specs || order?.specifications_prepress },
        { label: "Impresión", value: stageData?.press_specs || order?.specifications_press },
        { label: "Post-Impresión", value: stageData?.postpress_specs || order?.specifications_postpress },
        { label: "General", value: order?.specifications }
    ].filter(s => s.value)

    return (
        <div className="w-80 border-l bg-muted/5 p-4 flex flex-col h-full space-y-4 hidden lg:flex">
            <ScrollArea className="flex-1 -mr-4 pr-4">
                <Accordion type="multiple" defaultValue={["info", "specs", "comments"]} className="w-full">
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
                            <div className="space-y-4">
                                {/* Comment Feed */}
                                <div className="space-y-3">
                                    {comments.length > 0 ? comments.map((comment, i) => (
                                        <div key={i} className="flex gap-2">
                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <span className="text-[10px] font-bold text-primary">
                                                    {comment.user.substring(0, 2).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex-1 bg-background rounded-lg border p-2 space-y-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[10px] font-bold truncate">{comment.user}</span>
                                                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                                                        {new Date(comment.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{comment.text}</p>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-8 space-y-2">
                                            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                                            <p className="text-[11px] text-muted-foreground">No hay comentarios aún</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </ScrollArea>

            {/* Comment Input (Fixed at bottom of sidebar) */}
            <div className="pt-4 border-t mt-auto">
                <div className="relative">
                    <Textarea
                        placeholder="Agregar comentario..."
                        className="min-h-[80px] text-xs resize-none pr-10 bg-background"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSendComment()
                            }
                        }}
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-2 bottom-2 h-7 w-7"
                        onClick={handleSendComment}
                        disabled={!newComment.trim()}
                    >
                        <Send className="h-4 w-4 text-primary" />
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center flex items-center justify-center gap-1">
                    <History className="h-3 w-3" />
                    Se registra autor y hora automáticamente
                </p>
            </div>
        </div>
    )
}
