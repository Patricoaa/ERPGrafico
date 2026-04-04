"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, UserCog } from "lucide-react"
import { partnersApi } from "@/features/contacts/api/partnersApi"

const partnerSetupSchema = z.object({
    is_partner: z.boolean(),
    partner_equity_percentage: z.string().optional(),
    // Normally you'd have an account selector here. For simplicity, we just allow the percentage and boolean for now, 
    // or you could add partner_account_id if you have an AccountSelector component.
})

type SetupValues = z.infer<typeof partnerSetupSchema>

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact: any | null
    onSuccess: () => void
}

export function PartnerEditModal({ open, onOpenChange, contact, onSuccess }: Props) {
    const [submitting, setSubmitting] = useState(false)

    const form = useForm<SetupValues>({
        resolver: zodResolver(partnerSetupSchema),
        defaultValues: {
            is_partner: true,
            partner_equity_percentage: "",
        }
    })

    useEffect(() => {
        if (open && contact) {
            form.reset({
                is_partner: contact.is_partner ?? true,
                partner_equity_percentage: contact.partner_equity_percentage?.toString() || "",
            })
        }
    }, [open, contact, form])

    const onSubmit = async (data: SetupValues) => {
        if (!contact) return
        setSubmitting(true)
        try {
            await partnersApi.setupPartner(contact.id, {
                is_partner: data.is_partner,
                partner_equity_percentage: data.partner_equity_percentage ? parseFloat(data.partner_equity_percentage) : undefined,
            })
            toast.success("Configuración de socio actualizada")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al actualizar")
        } finally {
            setSubmitting(false)
        }
    }

    if (!contact) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCog className="h-5 w-5 text-primary" />
                        Editar Socio
                    </DialogTitle>
                    <DialogDescription>
                        Ajuste la participación de {contact.name}.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        
                        <FormField
                            control={form.control}
                            name="is_partner"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-muted/10">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>
                                            Es Socio de la Empresa
                                        </FormLabel>
                                        <FormDescription className="text-xs">
                                            Habilita o deshabilita a este contacto del módulo societario. Al desmarcar, desaparecerá de la lista.
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="partner_equity_percentage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Porcentaje de Participación (%)</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            min="0" 
                                            max="100" 
                                            step="0.01" 
                                            placeholder="Ej: 33.33" 
                                            {...field} 
                                            disabled={!form.watch('is_partner')}
                                        />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                        Deje en blanco si no aplica.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={submitting} className="font-bold">
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
