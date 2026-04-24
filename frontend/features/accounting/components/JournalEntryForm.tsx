"use client"

import { getErrorMessage } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm, useFieldArray, useWatch, Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { JournalEntryInitialData } from "@/types/forms"
import * as z from "zod"
import { CalendarIcon, Plus, Trash2, Pencil, BookOpen, ShieldAlert } from "lucide-react"
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
import { validateAccountingPeriod } from '@/features/accounting/actions'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";
import { LabeledInput } from "@/components/shared";

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
    auditSidebar?: React.ReactNode
    accounts?: Record<string, unknown>[]
    onSuccess?: () => void
    initialData?: JournalEntryInitialData
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
            <div className={cn("flex flex-col items-end", isBalanced ? "text-success" : "text-destructive")}>
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
    onOpenChange,
    auditSidebar
}: JournalEntryFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [periodCheck, setPeriodCheck] = useState<{ is_closed: boolean; loading: boolean }>({ is_closed: false, loading: false })
    const [accounts, setAccounts] = useState<Record<string, unknown>[]>(accountsProp || [])

    // Guard for async operations
    const isMounted = useRef(true)

    // Sync local accounts state if prop changes
    useEffect(() => {
        if (accountsProp && accountsProp.length > 0) {
            setAccounts(accountsProp)
        }
    }, [accountsProp])

    // Cleanup mount guard
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

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

    const selectedDate = form.watch("date")

    // Effect to check period closure on date change
    useEffect(() => {
        if (selectedDate) {
            const checkPeriod = async () => {
                setPeriodCheck(prev => ({ ...prev, loading: true }))
                const result = await validateAccountingPeriod(format(selectedDate, "yyyy-MM-dd"))
                if (isMounted.current) {
                    setPeriodCheck({ is_closed: result.is_closed, loading: false })
                }
            }
            checkPeriod()
        }
    }, [selectedDate])

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounting/accounts/?is_leaf=true')
            if (isMounted.current) {
                setAccounts(response.data.results || response.data)
            }
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
            // Pre-submission period check
            const check = await validateAccountingPeriod(format(data.date, "yyyy-MM-dd"))
            if (check.is_closed) {
                toast.error("No se puede registrar el asiento: El periodo contable está cerrado.")
                setLoading(false)
                return
            }

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
        } catch (error: unknown) {
            console.error("Error saving entry:", error)
            const detail = getErrorMessage(error) || "Error al guardar el asiento"
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
                size={initialData ? "xl" : "lg"}
                title={
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <span>{initialData ? "Editar Asiento" : "Nuevo Asiento Contable"}</span>
                    </div>
                }
                description={
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        {initialData?.reference && (
                            <>
                                <span>Ref: {initialData.reference}</span>
                                <span className="opacity-30">|</span>
                            </>
                        )}
                        <span>{form.watch("description") || "Registro manual de movimiento"}</span>
                    </div>
                }
                footer={
                    <div className="flex justify-end space-x-2 w-full">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <ActionSlideButton type="submit" form="journal-entry-form" disabled={loading}>
                            {loading ? "Guardando..." : (initialData ? "Actualizar Asiento" : "Crear Asiento")}
                        </ActionSlideButton>
                    </div>
                }
            >
                <div className="flex-1 flex overflow-hidden min-h-[400px]">
                    <div className="flex-1 flex flex-col overflow-y-auto pt-4 scrollbar-thin">
                        <Form {...form}>
                            <form id="journal-entry-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4 pl-1 pb-4">
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-3">
                                        <FormField
                                            control={form.control}
                                            name="date"
                                            render={({ field, fieldState }) => (
                                                <div className="relative w-full flex flex-col group">
                                                    <fieldset 
                                                        className={cn(
                                                            "notched-field w-full group transition-all",
                                                            fieldState.error && "error"
                                                        )}
                                                    >
                                                        <legend className={cn("notched-legend", fieldState.error && "text-destructive")}>Fecha</legend>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant={"ghost"}
                                                                className={cn(
                                                                    "w-full pl-3 text-left font-normal border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent h-auto py-2",
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
                                                    </fieldset>
                                                    {fieldState.error && (
                                                        <p className="mt-1.5 text-[11px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 w-full text-left px-1">
                                                            {fieldState.error.message}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        />
                                        {periodCheck.is_closed && (
                                            <Alert variant="destructive" className="mt-2 py-2 px-3 border-destructive/20 bg-destructive/5">
                                                <ShieldAlert className="h-4 w-4 text-destructive" />
                                                <AlertDescription className="text-[10px] leading-tight ml-2">
                                                    Periodo Contable Cerrado
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                    <div className="col-span-6">
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Descripción"
                                                    placeholder="Venta de mercadería..."
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <FormField
                                            control={form.control}
                                            name="reference"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Referencia"
                                                    placeholder="FAC-123"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="relative py-4">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-border" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground font-semibold tracking-widest text-[10px]">
                                            LÍNEAS DEL ASIENTO
                                        </span>
                                    </div>
                                </div>

                                <div className="border rounded-md p-2">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-b">
                                                <TableHead className={cn(FORM_STYLES.label, "w-[300px] text-center")}>Cuenta</TableHead>
                                                <TableHead className={cn(FORM_STYLES.label, "text-center")}>Glosa</TableHead>
                                                <TableHead className={cn(FORM_STYLES.label, "w-[150px] text-center")}>Debe</TableHead>
                                                <TableHead className={cn(FORM_STYLES.label, "w-[150px] text-center")}>Haber</TableHead>
                                                <TableHead className="w-[50px] text-center">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {fields.map((field, index) => (
                                                <TableRow key={field.id} className="hover:bg-primary/5 transition-colors">
                                                    <TableCell className="p-2">
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
                                                    <TableCell className="p-2">
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.label`}
                                                            render={({ field }) => (
                                                                <FormItem className="space-y-0">
                                                                    <FormControl>
                                                                        <Input {...field} className={cn(FORM_STYLES.input, "h-8 text-center")} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2">
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.debit`}
                                                            render={({ field }) => (
                                                                <FormItem className="space-y-0 text-center">
                                                                    <FormControl>
                                                                        <Input type="number" step="1" {...field} onChange={e => field.onChange(Math.ceil(e.target.valueAsNumber || 0))} onFocus={(e) => e.target.select()} className={cn(FORM_STYLES.input, "h-8 text-right font-mono font-bold")} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2">
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.credit`}
                                                            render={({ field }) => (
                                                                <FormItem className="space-y-0 text-center">
                                                                    <FormControl>
                                                                        <Input type="number" step="1" {...field} onChange={e => field.onChange(Math.ceil(e.target.valueAsNumber || 0))} onFocus={(e) => e.target.select()} className={cn(FORM_STYLES.input, "h-8 text-right font-mono font-bold")} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 text-center">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => remove(index)}
                                                            className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
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
                                    <div className="text-destructive text-sm text-right font-medium">
                                        {form.formState.errors.items.root.message}
                                    </div>
                                )}
                            </form>
                        </Form>
                    </div>

                    {initialData?.id && (
                        <div className="w-72 border-l bg-muted/5 flex flex-col pt-4 hidden lg:flex">
                            {auditSidebar}
                        </div>
                    )}
                </div>
            </BaseModal>
        </>
    )
}
