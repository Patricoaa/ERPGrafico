"use client"

import { useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2 } from "lucide-react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const exclusionSchema = z.object({
    reason: z.string().min(1, "Debes seleccionar un motivo"),
    notes: z.string().optional()
})

type ExclusionFormValues = z.infer<typeof exclusionSchema>

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
    
    const form = useForm<ExclusionFormValues>({
        resolver: zodResolver(exclusionSchema),
        defaultValues: {
            reason: "DUPLICATE",
            notes: ""
        }
    })

    const { isSubmitting } = form.formState

    useEffect(() => {
        if (open) {
            form.reset({ reason: "DUPLICATE", notes: "" })
        }
    }, [open, form])

    const onSubmit = async (data: ExclusionFormValues) => {
        try {
            await onConfirm(data.reason, data.notes || "")
            onOpenChange(false)
        } catch (error) {
            // Handled in mutation
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
                    <Button 
                        variant="outline" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isSubmitting} 
                        className="text-xs font-bold uppercase"
                    >
                        Cancelar
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                        className="font-black uppercase tracking-widest px-6 text-xs"
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Exclusión"}
                    </Button>
                </div>
            }
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase leading-relaxed opacity-80">
                        El movimiento se ocultará de la conciliación activa. La justificación es obligatoria para fines de auditoría.
                    </p>
                    
                    <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold uppercase">Motivo de Exclusión</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="font-bold uppercase text-xs h-9">
                                            <SelectValue placeholder="Selecciona un motivo" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="DUPLICATE">Transacción Duplicada</SelectItem>
                                        <SelectItem value="INTERNAL">Traspaso Interno</SelectItem>
                                        <SelectItem value="ADJUSTMENT">Ajuste de Saldo</SelectItem>
                                        <SelectItem value="ERROR">Error de Importación</SelectItem>
                                        <SelectItem value="OTHER">Otro (Especificar)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold uppercase">Notas Adicionales</FormLabel>
                                <FormControl>
                                    <Textarea
                                        {...field}
                                        rows={3}
                                        placeholder="Detalla por qué excluyes este movimiento..."
                                        className="text-xs font-medium resize-none"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </BaseModal>
    )
}
