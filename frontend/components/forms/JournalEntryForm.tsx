"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray, useWatch, Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CalendarIcon, Plus, Trash2, Pencil } from "lucide-react"
import { format } from "date-fns"
import { BaseModal } from "@/components/shared/BaseModal"

// ... other imports same
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { FORM_STYLES } from "@/lib/styles"
import { useServerDate } from "@/hooks/useServerDate"

// JournalItem and JournalEntry schemas remain the same
const journalItemSchema = z.object({
    id: z.number().optional(),
    account: z.string().min(1, "Cuenta requerida"),
    partner: z.string().optional(),
    label: z.string().optional(),
    debit: z.number().min(0),
    credit: z.number().min(0),
})

const journalEntrySchema = z.object({
    date: z.date(),
    description: z.string().min(3, "La descripción debe tener al menos 3 caracteres"),
    reference: z.string().optional(),
    items: z.array(journalItemSchema).min(2, "El asiento debe tener al menos 2 líneas"),
}).refine((data) => {
    const totalDebit = data.items.reduce((sum, item) => sum + (item.debit || 0), 0)
    const totalCredit = data.items.reduce((sum, item) => sum + (item.credit || 0), 0)
    return Math.abs(totalDebit - totalCredit) < 0.01 // Floating point tolerance
}, {
    message: "El asiento no está cuadrado (Debe != Haber)",
    path: ["items"],
})

type JournalEntryFormValues = z.infer<typeof journalEntrySchema>

interface JournalEntryFormProps {
    accounts?: any[]
    onSuccess?: () => void
    initialData?: any
    triggerText?: string
    triggerVariant?: "default" | "circular"
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

const TotalBalance = ({ control }: { control: Control<JournalEntryFormValues> }) => {
    const items = useWatch({
        control,
        name: "items",
    })

    const totalDebit = items?.reduce((sum, item) => sum + (Number(item.debit) || 0), 0) || 0
    const totalCredit = items?.reduce((sum, item) => sum + (Number(item.credit) || 0), 0) || 0
    const diff = totalDebit - totalCredit
    const isBalanced = Math.abs(diff) < 0.01

    return (
        <div className="flex justify-end space-x-4 text-sm font-medium pt-2 border-t">
            <div className={cn("flex flex-col items-end", isBalanced ? "text-green-600" : "text-red-500")}>
                <span>Total Debe: {totalDebit.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                <span>Total Haber: {totalCredit.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                {!isBalanced && <span>Diferencia: {diff.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>}
            </div>
        </div>
    )
}

export function JournalEntryForm({
    accounts: accountsProp,
    onSuccess,
    initialData,
    triggerText = "Nuevo Asiento",
    triggerVariant = "default",
    open: openProp,
    onOpenChange
}: JournalEntryFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [accounts, setAccounts] = useState<any[]>(accountsProp || [])

    // Sync local accounts state if prop changes
    useEffect(() => {
        if (accountsProp && accountsProp.length > 0) {
            setAccounts(accountsProp)
        }
    }, [accountsProp])

    const { serverDate } = useServerDate()

    // Convert string date to Date object if editing
    const getDefaultValues = () => {
        if (initialData) {
            return {
                ...initialData,
                date: new Date(initialData.date),
                items: initialData.items.map((item: any) => ({
                    ...item,
                    account: item.account.toString(),
                    debit: parseFloat(item.debit),
                    credit: parseFloat(item.credit),
                }))
            }
        } else {
            return {
                date: serverDate || new Date(),
                description: "",
                reference: "",
                items: [
                    { account: "", label: "", debit: 0, credit: 0 },
                    { account: "", label: "", debit: 0, credit: 0 },
                ],
            }
        }
    }

    const defaultValues: Partial<JournalEntryFormValues> = getDefaultValues()

    const form = useForm<JournalEntryFormValues>({
        resolver: zodResolver(journalEntrySchema),
        defaultValues,
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounting/accounts/?is_leaf=true')
            setAccounts(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching accounts:", error)
        }
    }

    useEffect(() => {
        if (open) {
            if (!accountsProp || accountsProp.length === 0) {
                fetchAccounts()
            }
            if (!initialData) {
                form.reset({
                    date: serverDate || new Date(),
                    description: "",
                    items: [
                        { account: "", label: "", debit: 0, credit: 0 },
                        { account: "", label: "", debit: 0, credit: 0 },
                    ]
                })
            } else {
                // Force reset with initial data when editing
                form.reset(defaultValues)
            }
        }
    }, [open, initialData, accountsProp, serverDate])

    async function onSubmit(data: JournalEntryFormValues) {
        setLoading(true)
        try {
            const payload = {
                ...data,
                date: format(data.date, "yyyy-MM-dd"),
            }

            if (initialData?.id) {
                await api.put(`/accounting/entries/${initialData.id}/`, payload)
                toast.success("Asiento actualizado correctamente")
            } else {
                await api.post('/accounting/entries/', payload)
                toast.success("Asiento creado correctamente")
            }

            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving entry:", error)
            const detail = error.response?.data?.error || error.response?.data?.detail || "Error al guardar el asiento"
            // Check if validation array error
            if (typeof detail === 'object') {
                toast.error("Error de validación: Revise los campos")
            } else {
                toast.error(detail)
            }
        } finally {
            setLoading(false)
        }
    }

    const Trigger = () => {
        if (openProp !== undefined) return null;
        if (initialData && triggerVariant !== "circular") return null;

        return (
            <div onClick={() => setOpen(true)}>
                {triggerVariant === "circular" ? (
                    <Button size="icon" className="rounded-full h-8 w-8" title="Nuevo Asiento">
                        <Plus className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant={initialData ? "ghost" : "default"} size={initialData ? "icon" : "default"}>
                        {initialData ? <Pencil className="h-4 w-4" /> : triggerText}
                    </Button>
                )}
            </div>
        )
    }

    return (
        <>
            <Trigger />
            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="xl"
                title={initialData ? "Editar Asiento" : "Nuevo Asiento Contable"}
                description="Ingrese los detalles del movimiento contable."
                footer={
                    <div className="flex justify-end space-x-2 w-full">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" form="journal-entry-form" disabled={loading}>
                            {loading ? "Guardando..." : (initialData ? "Actualizar Asiento" : "Crear Asiento")}
                        </Button>
                    </div>
                }
            >
                <Form {...form}>
                    <form id="journal-entry-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-3">
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className={FORM_STYLES.label}>Fecha</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                FORM_STYLES.input,
                                                                "w-full pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value ? (
                                                                format(field.value, "PPP")
                                                            ) : (
                                                                <span>Seleccione fecha</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        disabled={(date) =>
                                                            date > new Date() || date < new Date("1900-01-01")
                                                        }
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="col-span-6">
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Descripción</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Venta de mercadería..." {...field} className={FORM_STYLES.input} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="col-span-3">
                                <FormField
                                    control={form.control}
                                    name="reference"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Referencia</FormLabel>
                                            <FormControl>
                                                <Input placeholder="FAC-123" {...field} className={FORM_STYLES.input} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="border rounded-md p-2">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[300px]">Cuenta</TableHead>
                                        <TableHead>Glosa</TableHead>
                                        <TableHead className="w-[150px]">Debe</TableHead>
                                        <TableHead className="w-[150px]">Haber</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id}>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`items.${index}.account`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-0">
                                                            <FormControl>
                                                                <AccountSelector
                                                                    value={field.value}
                                                                    onChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`items.${index}.label`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-0">
                                                            <FormControl>
                                                                <Input {...field} className={cn(FORM_STYLES.input, "h-8")} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`items.${index}.debit`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-0">
                                                            <FormControl>
                                                                <Input type="number" step="1" {...field} onChange={e => field.onChange(Math.ceil(e.target.valueAsNumber || 0))} onFocus={(e) => e.target.select()} className={cn(FORM_STYLES.input, "h-8")} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`items.${index}.credit`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-0">
                                                            <FormControl>
                                                                <Input type="number" step="1" {...field} onChange={e => field.onChange(Math.ceil(e.target.valueAsNumber || 0))} onFocus={(e) => e.target.select()} className={cn(FORM_STYLES.input, "h-8")} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => remove(index)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="flex justify-between items-center mt-2 px-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ account: "", label: "", debit: 0, credit: 0 })}
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Agregar Línea
                                </Button>
                                <TotalBalance control={form.control} />
                            </div>
                        </div>

                        <FormMessage className="text-right" />
                        {form.formState.errors.items?.root && (
                            <div className="text-red-500 text-sm text-right font-medium">
                                {form.formState.errors.items.root.message}
                            </div>
                        )}
                    </form>
                </Form>
            </BaseModal>
        </>
    )
}
