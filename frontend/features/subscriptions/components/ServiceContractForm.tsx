"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ServiceContractInitialData } from "@/types/forms"
import * as z from "zod"
import { Form, FormControl, FormDescription, FormField, FormItem } from "@/components/ui/form"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";
import { LabeledInput, LabeledSelect, LabeledContainer, PeriodValidationDateInput } from "@/components/shared"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { serviceContractSchema, type ServiceContractFormValues } from "./ServiceContractForm.schema"
import { Account } from "@/types/entities"

interface ServiceContractFormProps {
    onSuccess?: () => void
    initialData?: ServiceContractInitialData
}

export function ServiceContractForm({ onSuccess, initialData }: ServiceContractFormProps) {
    const router = useRouter()
    // const [suppliers, setSuppliers] = useState([])
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])

    const form = useForm<ServiceContractFormValues>({
        resolver: zodResolver(serviceContractSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            description: initialData?.notes || initialData?.description || "",
            supplier: initialData?.supplier?.toString() || "",
            category: initialData?.category?.toString() || "",
            recurrence_type: (initialData?.recurrence_period || "MONTHLY") as "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME",
            payment_day: initialData?.payment_day || 1,
            base_amount: Number(initialData?.amount || 0),
            is_amount_variable: initialData?.is_indefinite || false,
            start_date: initialData?.start_date || "",
            end_date: initialData?.end_date || "",
            auto_renew: initialData?.auto_renew || false,
            expense_account: initialData?.expense_account?.toString() || "inherited",
            payable_account: initialData?.payable_account?.toString() || "inherited",
        },
    })

    // Update defaults if initialData loads later (though usually passed fully formed)
    const lastResetId = useRef<number | undefined>(undefined)

    useEffect(() => {
        if (initialData && initialData.id !== lastResetId.current) {
            form.reset({
                name: initialData.name || "",
                description: initialData.notes || initialData.description || "",
                supplier: initialData.supplier?.toString() || "",
                category: initialData.category?.toString() || "",
                recurrence_type: (initialData.recurrence_period || "MONTHLY") as "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME",
                payment_day: initialData.payment_day || 1,
                base_amount: Number(initialData.amount || 0),
                is_amount_variable: initialData.is_indefinite || false,
                start_date: initialData.start_date || "",
                end_date: initialData.end_date || "",
                auto_renew: initialData.auto_renew || false,
                expense_account: initialData.expense_account?.toString() || "inherited",
                payable_account: initialData.payable_account?.toString() || "inherited",
            })
            lastResetId.current = initialData.id
        }
    }, [initialData, form])

    useEffect(() => {
        const loadData = async () => {
            try {
                const [catRes, accRes] = await Promise.all([
                    api.get('/services/categories/'),
                    api.get('/accounting/accounts/?account_type=EXPENSE,LIABILITY&is_leaf=true') // Filter leaf accounts
                ])
                setCategories(catRes.data.results || catRes.data)
                setAccounts(accRes.data.results || accRes.data)
            } catch (e) {
                console.error(e)
                toast.error("Error cargando datos")
            }
        }
        loadData()
    }, [])

    // Auto-fill accounts when category changes - only if they were empty or "inherited"
    const onCategoryChange = (catId: string) => {
        form.setValue("category", catId)
        // We don't force accounts anymore if they are to be "inherited" by default
    }

    const onSubmit: SubmitHandler<ServiceContractFormValues> = async (values) => {
        try {
            const data = {
                ...values,
                expense_account: values.expense_account === "inherited" ? null : values.expense_account,
                payable_account: values.payable_account === "inherited" ? null : values.payable_account,
            }

            if (initialData?.id) {
                await api.patch(`/services/contracts/${initialData.id}/`, data)
                toast.success("Contrato actualizado exitosamente")
            } else {
                await api.post("/services/contracts/", data)
                toast.success("Contrato creado exitosamente")
            }

            if (onSuccess) {
                onSuccess()
            } else {
                router.push("/services/contracts")
            }
        } catch (error: unknown) {
            console.error(error)
            showApiError(error, "Error al guardar contrato")
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                    {/* Basic Info */}
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormControl>
                                            <LabeledInput 
                                                label="Nombre del Servicio" 
                                                required 
                                                placeholder="Ej: Arriendo Oficina" 
                                                error={fieldState.error?.message}
                                                {...field} 
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormControl>
                                            <LabeledInput 
                                                as="textarea"
                                                label="Descripción" 
                                                error={fieldState.error?.message}
                                                {...field} 
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="supplier"
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormControl>
                                                <LabeledContainer label="Proveedor" error={fieldState.error?.message} required>
                                                    <AdvancedContactSelector
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        contactType="SUPPLIER"
                                                        placeholder="Buscar proveedor..."
                                                        className="border-0 focus-visible:ring-0 h-8"
                                                    />
                                                </LabeledContainer>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field, fieldState }) => (
                                        <LabeledSelect
                                            label="Categoría"
                                            required
                                            error={fieldState.error?.message}
                                            onChange={onCategoryChange}
                                            value={field.value}
                                            placeholder="Seleccionar..."
                                            options={categories.map((c) => ({ value: c.id.toString(), label: c.name }))}
                                        />
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recurrence & Amount */}
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="recurrence_type"
                                    render={({ field, fieldState }) => (
                                        <LabeledSelect
                                            label="Frecuencia"
                                            required
                                            error={fieldState.error?.message}
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={[
                                                { value: "MONTHLY", label: "Mensual" },
                                                { value: "QUARTERLY", label: "Trimestral" },
                                                { value: "ANNUAL", label: "Anual" },
                                                { value: "ONE_TIME", label: "Único" },
                                            ]}
                                        />
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="payment_day"
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormControl>
                                                <LabeledInput 
                                                    type="number" 
                                                    min={1} 
                                                    max={31} 
                                                    label="Día de Pago" 
                                                    required 
                                                    error={fieldState.error?.message}
                                                    {...field} 
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="base_amount"
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormControl>
                                                <LabeledInput
                                                    type="number"
                                                    step="0.01"
                                                    label="Monto Base"
                                                    required
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                    disabled={form.watch("is_amount_variable")}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="is_amount_variable"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-dashed p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto Variable</span>
                                                <FormDescription className="text-[10px]">El monto cambia cada mes</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={(val) => {
                                                        field.onChange(val)
                                                        if (val) form.setValue("base_amount", 0)
                                                    }}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dates & More Column (Dates + Renewal) */}
                    <div className="space-y-6">
                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="start_date"
                                        render={({ field, fieldState }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <PeriodValidationDateInput
                                                        date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                                                        onDateChange={(date) => {
                                                            if (!date) {
                                                                field.onChange(null)
                                                                return
                                                            }
                                                            field.onChange(date.toISOString().split('T')[0])
                                                        }}
                                                        label="Fecha Inicio"
                                                        validationType="tax"
                                                        required
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="end_date"
                                        render={({ field, fieldState }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <PeriodValidationDateInput
                                                        date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                                                        onDateChange={(date) => {
                                                            if (!date) {
                                                                field.onChange(null)
                                                                return
                                                            }
                                                            field.onChange(date.toISOString().split('T')[0])
                                                        }}
                                                        label="Fecha Término"
                                                        validationType="tax"
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="auto_renew"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-dashed p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Renovación Automática</span>
                                                <FormDescription className="text-[10px]">Extender automáticamente</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Accounting details */}
                        <Card className="border-info/10 bg-primary/10/10">
                            <CardContent className="pt-6 space-y-4">
                                <h3 className="text-sm font-semibold text-info border-b pb-2 flex justify-between items-center">
                                    Configuración Contable
                                    <span className="text-[10px] font-normal text-muted-foreground uppercase">Avanzado</span>
                                </h3>
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="expense_account"
                                        render={({ field, fieldState }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <LabeledContainer label="Cuenta Gasto" error={fieldState.error?.message}>
                                                        <Select onValueChange={field.onChange} value={field.value || "inherited"}>
                                                            <SelectTrigger className="border-0 focus:ring-0 h-8 px-2">
                                                                <SelectValue placeholder="Heredado" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="inherited" className="font-semibold text-primary italic">Heredar de categoría (Recomendado)</SelectItem>
                                                                {accounts.filter((a) => a.account_type === 'EXPENSE').map((a) => (
                                                                    <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </LabeledContainer>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="payable_account"
                                        render={({ field, fieldState }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <LabeledContainer label="Cuenta Pasivo" error={fieldState.error?.message}>
                                                        <Select onValueChange={field.onChange} value={field.value || "inherited"}>
                                                            <SelectTrigger className="border-0 focus:ring-0 h-8 px-2">
                                                                <SelectValue placeholder="Heredado" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="inherited" className="font-semibold text-primary italic">Heredar de categoría (Recomendado)</SelectItem>
                                                                {accounts.filter((a) => a.account_type === 'LIABILITY').map((a) => (
                                                                    <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </LabeledContainer>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                </div>
                <ActionSlideButton type="submit">{initialData ? 'Actualizar Contrato' : 'Crear Contrato'}</ActionSlideButton>
            </form>
        </Form>
    )
}
