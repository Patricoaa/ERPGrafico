"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
    Search, 
    CreditCard, 
    User, 
    AlertCircle, 
    Check,
    Banknote,
    TrendingUp,
    Clock
} from "lucide-react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { BaseModal } from "@/components/shared/BaseModal"
import { useContactMutations } from "@/features/contacts/hooks/useContacts"
import { CreditContact } from "@/lib/credits/api"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

const creditSchema = z.object({
    credit_limit: z.coerce.number().min(0, "El límite debe ser mayor o igual a 0").nullable(),
})

interface CreditAssignmentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact?: CreditContact | null
    onSuccess?: () => void
}

export default function CreditAssignmentModal({ 
    open, 
    onOpenChange, 
    contact: initialContact,
    onSuccess 
}: CreditAssignmentModalProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<CreditContact[]>([])
    const [selectedContact, setSelectedContact] = useState<CreditContact | null>(null)
    const [searching, setSearching] = useState(false)
    const { updateContact, isUpdating } = useContactMutations()

    const form = useForm<z.infer<typeof creditSchema>>({
        resolver: zodResolver(creditSchema),
        defaultValues: {
            credit_limit: null,
        },
    })

    // Reset when modal opens or contact changes
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                if (initialContact) {
                    setSelectedContact(initialContact)
                    form.reset({
                        credit_limit: initialContact.credit_limit ? Number(initialContact.credit_limit) : null
                    })
                } else {
                    setSelectedContact(null)
                    form.reset({ credit_limit: null })
                    setSearchQuery("")
                    setSearchResults([])
                }
            })
        }
    }, [open, initialContact, form])

    // Search contacts
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length >= 2 && !initialContact) {
                setSearching(true)
                api.get(`/contacts/?search=${searchQuery}`)
                    .then(res => {
                        const results = res.data.results || res.data
                        setSearchResults(results)
                    })
                    .finally(() => setSearching(false))
            } else {
                setSearchResults([])
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery, initialContact])

    const onSubmit = async (values: z.infer<typeof creditSchema>) => {
        const currentContact = selectedContact || initialContact
        if (!currentContact) return

        try {
            await updateContact({
                id: currentContact.id,
                payload: {
                    credit_enabled: (values.credit_limit || 0) > 0,
                    credit_limit: values.credit_limit,
                }
            })
            onOpenChange(false)
            if (onSuccess) onSuccess()
        } catch (error) {
            console.error(error)
        }
    }

    const fmt = (val: number | string) => Number(val).toLocaleString()

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={initialContact ? "Editar Línea de Crédito" : "Asignar Nueva Línea de Crédito"}
            description={initialContact ? "Ajuste el cupo autorizado para este cliente." : "Busque un contacto para habilitar su cupo de crédito."}
            size="md"
        >
            <div className="space-y-6">
                {!initialContact && !selectedContact && (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre o RUT..."
                                className="pl-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                            {searching && <div className="text-center py-4 text-sm text-muted-foreground">Buscando...</div>}
                            {!searching && searchResults.map((c) => (
                                <button
                                    key={c.id}
                                    disabled={c.credit_blocked}
                                    onClick={() => {
                                        setSelectedContact(c)
                                        form.reset({ credit_limit: c.credit_limit ? Number(c.credit_limit) : null })
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left group",
                                        c.credit_blocked 
                                            ? "bg-muted/50 border-border/50 cursor-not-allowed opacity-75" 
                                            : "bg-card hover:bg-accent border-border hover:border-primary/20"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "h-10 w-10 rounded-full flex items-center justify-center font-bold",
                                            c.credit_blocked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                                        )}>
                                            {c.name[0]}
                                        </div>
                                        <div>
                                            <div className={cn("font-semibold", c.credit_blocked && "text-muted-foreground")}>{c.name}</div>
                                            <div className="text-[11px] text-muted-foreground font-mono">{c.tax_id}</div>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "transition-opacity",
                                        c.credit_blocked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                    )}>
                                        {c.credit_blocked ? (
                                            <Badge variant="destructive" className="gap-1 bg-destructive/10 text-destructive border-destructive/20">
                                                BLOQUEADO <AlertCircle className="h-3 w-3" />
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="gap-1 border-primary/20 bg-primary/5 text-primary">
                                                Seleccionar <Check className="h-3 w-3" />
                                            </Badge>
                                        )}
                                    </div>
                                </button>
                            ))}
                            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                                <div className="text-center py-8">
                                    <User className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No se encontraron contactos.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {(initialContact || selectedContact) && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Header Context */}
                        <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/10 mb-6">
                            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                <CreditCard className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg truncate">{(selectedContact || initialContact)?.name}</h3>
                                    {!initialContact && (
                                        <button 
                                            onClick={() => setSelectedContact(null)}
                                            className="text-[10px] text-primary hover:underline font-bold"
                                        >
                                            Cambiar
                                        </button>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">{(selectedContact || initialContact)?.tax_id}</div>
                            </div>
                        </div>

                        {/* Indicators grid */}
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <div className="p-4 rounded-lg border bg-muted/30 flex flex-col gap-1 items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-success mb-1" />
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Disponible</span>
                                <span className="text-lg font-mono font-black text-success">
                                    ${fmt((selectedContact || initialContact)?.credit_available || 0)}
                                </span>
                            </div>
                            <div className="p-4 rounded-lg border bg-muted/30 flex flex-col gap-1 items-center justify-center">
                                <Banknote className="h-4 w-4 text-destructive mb-1" />
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Utilizado</span>
                                <span className="text-lg font-mono font-black text-destructive">
                                    ${fmt((selectedContact || initialContact)?.credit_balance_used || 0)}
                                </span>
                            </div>
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="credit_limit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-2">
                                                <Banknote className="h-4 w-4 text-muted-foreground" />
                                                Límite de Crédito Autorizado ($)
                                            </FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground/30">$</span>
                                                    <Input
                                                        type="number"
                                                        placeholder="Eje: 1,000,000"
                                                        className="h-14 pl-10 text-2xl font-mono font-black border-2 focus-visible:ring-primary/20 bg-background transition-all"
                                                        {...field}
                                                        value={field.value || ""}
                                                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                                    />
                                                </div>
                                            </FormControl>
                                            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/10 mt-2">
                                                <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                                                <p className="text-[11px] text-warning leading-tight">
                                                    Establezca 0 o deje vacío para deshabilitar el crédito. 
                                                    Los días de plazo se aplican automáticamente según la política global.
                                                </p>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1 h-12"
                                        onClick={() => onOpenChange(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <ActionSlideButton
                                        type="submit"
                                        className="flex-[2] h-12 font-bold shadow-md shadow-primary/25"
                                        disabled={isUpdating}
                                    >
                                        {isUpdating ? "Guardando..." : "Confirmar Asignación"}
                                    </ActionSlideButton>
                                </div>
                            </form>
                        </Form>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
