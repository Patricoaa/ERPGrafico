"use client"

import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { PricingUtils } from "@/lib/pricing"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"

// schemas and types remain the same
const formSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    product: z.number().nullable().optional(),
    uom: z.number().nullable().optional(),
    operator: z.enum(["GT", "LT", "EQ", "GE", "LE", "BT"]),
    min_quantity: z.string().or(z.number()),
    max_quantity: z.string().or(z.number()).nullable().optional(),
    rule_type: z.enum(["FIXED", "DISCOUNT_PERCENTAGE", "PACKAGE_FIXED"]),
    fixed_price: z.string().or(z.number()).nullable().optional(),
    fixed_price_gross: z.string().or(z.number()).nullable().optional(),
    discount_percentage: z.string().or(z.number()).nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    priority: z.number(),
    active: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

interface PricingRuleFormProps {
    initialData?: any
    onSuccess?: () => void
    open: boolean
    onOpenChange: (open: boolean) => void
    productId?: number
    productName?: string
}

export function PricingRuleForm({ initialData, onSuccess, open, onOpenChange, productId, productName }: PricingRuleFormProps) {
    const [uoms, setUoms] = useState<any[]>([])

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            rule_type: "FIXED",
            min_quantity: "1",
            priority: 0,
            active: true,
            product: productId || null,
            uom: null,
            operator: "GE",
            max_quantity: null,
            fixed_price: null,
            discount_percentage: null,
            start_date: null,
            end_date: null,
        },
    })

    const ruleType = form.watch("rule_type")
    const operator = form.watch("operator")

    useEffect(() => {
        if (open) {
            // Reset form when dialog opens
            if (initialData) {
                form.reset({
                    name: initialData.name || "",
                    rule_type: initialData.rule_type || "FIXED",
                    operator: initialData.operator ?? "GE",
                    min_quantity: initialData.min_quantity !== undefined ? String(initialData.min_quantity) : "1",
                    max_quantity: initialData.max_quantity ? String(initialData.max_quantity) : null,
                    fixed_price: initialData.fixed_price ? String(initialData.fixed_price) : null,
                    fixed_price_gross: initialData.fixed_price_gross ? String(initialData.fixed_price_gross) : null,
                    discount_percentage: initialData.discount_percentage ? String(initialData.discount_percentage) : null,
                    priority: initialData.priority ?? 0,
                    active: initialData.active ?? true,
                    product: initialData.product || productId || null,
                    uom: initialData.uom || null,
                    start_date: initialData.start_date || null,
                    end_date: initialData.end_date || null,
                })
            } else {
                form.reset({
                    name: "",
                    rule_type: "FIXED",
                    min_quantity: "1",
                    priority: 0,
                    active: true,
                    product: productId || null,
                    uom: null,
                    operator: "GE",
                    max_quantity: null,
                    fixed_price: null,
                    fixed_price_gross: null,
                    discount_percentage: null,
                    start_date: null,
                    end_date: null,
                })
            }
        }
    }, [open, initialData, productId, form])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const uomRes = await api.get('/inventory/uoms/')
                setUoms(uomRes.data.results || uomRes.data)
            } catch (error) {
                console.error("Error fetching data", error)
            }
        }
        if (open) {
            fetchData()
        }
    }, [open])

    async function onSubmit(values: FormValues) {
        try {
            // Clean up null values or strings that should be null
            const payload = { ...values }
            if (payload.product === null) delete payload.product
            if (payload.uom === null) delete payload.uom
            if (payload.operator !== "BT") delete payload.max_quantity

            if (initialData) {
                await api.put(`/inventory/pricing-rules/${initialData.id}/`, payload)
                toast.success("Regla actualizada correctamente")
            } else {
                await api.post("/inventory/pricing-rules/", payload)
                toast.success("Regla creada correctamente")
            }
            onSuccess?.()
            onOpenChange?.(false)
        } catch (error: any) {
            console.error(error)
            toast.error("Error al guardar la regla")
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            title={initialData ? "Editar Regla" : "Nueva Regla de Precio"}
            footer={
                <div className="flex justify-end space-x-2 w-full">
                    <Button type="submit" form="pricing-rule-form">
                        {initialData ? "Actualizar" : "Crear"} Regla
                    </Button>
                </div>
            }
        >
            <div className="flex-1 flex overflow-hidden min-h-[400px]">
                <div className="flex-1 flex flex-col overflow-y-auto pt-4 scrollbar-thin">
                    <Form {...form}>
                        <form id="pricing-rule-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-1">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Nombre de la Regla</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ej: Descuento Mayorista" className={cn(FORM_STYLES.input, "focus-visible:ring-primary")} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 gap-4">
                                <FormField
                                    control={form.control}
                                    name="product"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Producto</FormLabel>
                                            <FormControl>
                                                <ProductSelector
                                                    value={field.value?.toString() || null}
                                                    onChange={(val) => field.onChange(val ? parseInt(val) : null)}
                                                    disabled={!!productId}
                                                    placeholder="Seleccione un producto (Si no selecciona, se aplicaran a todos)"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="operator"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Condición (Operador)</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className={FORM_STYLES.input}>
                                                        <SelectValue placeholder="Seleccione" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="GE">Mayor o Igual ( {">"}= )</SelectItem>
                                                    <SelectItem value="GT">Mayor que ( {">"} )</SelectItem>
                                                    <SelectItem value="LE">Menor o Igual ( {"<"}= )</SelectItem>
                                                    <SelectItem value="LT">Menor que ( {"<"} )</SelectItem>
                                                    <SelectItem value="EQ">Igual a ( = )</SelectItem>
                                                    <SelectItem value="BT">Entre (Rango)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="priority"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Prioridad</FormLabel>
                                            <FormControl>
                                                <Input type="number" className={cn(FORM_STYLES.input, "focus-visible:ring-primary")} {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="min_quantity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>{operator === "BT" ? "Desde" : "Cantidad"}</FormLabel>
                                            <FormControl>
                                                <Input type="number" className={cn(FORM_STYLES.input, "focus-visible:ring-primary")} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="uom"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Unidad de Medida (Opcional)</FormLabel>
                                            <Select
                                                onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))}
                                                value={field.value?.toString() || "none"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className={FORM_STYLES.input}>
                                                        <SelectValue placeholder="Base del producto" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">Base del producto</SelectItem>
                                                    {uoms.map((u) => (
                                                        <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {operator === "BT" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="max_quantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className={FORM_STYLES.label}>Hasta</FormLabel>
                                                <FormControl>
                                                    <Input type="number" className={cn(FORM_STYLES.input, "focus-visible:ring-primary")} {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="rule_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Tipo de Regla</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className={FORM_STYLES.input}>
                                                        <SelectValue placeholder="Seleccione tipo" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="FIXED">Precio Fijo (Unitario)</SelectItem>
                                                    <SelectItem value="PACKAGE_FIXED">Precio Paquete (Total Fijo)</SelectItem>
                                                    <SelectItem value="DISCOUNT_PERCENTAGE">Porcentaje de Descuento</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {ruleType === "FIXED" || ruleType === "PACKAGE_FIXED" ? (
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="fixed_price"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className={FORM_STYLES.label}>Precio Fijo (Neto)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            className={cn(FORM_STYLES.input, "focus-visible:ring-primary")}
                                                            {...field}
                                                            value={field.value || ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                field.onChange(val);
                                                                if (val) {
                                                                    const gross = PricingUtils.netToGross(parseFloat(val));
                                                                    form.setValue("fixed_price_gross", String(gross));
                                                                } else {
                                                                    form.setValue("fixed_price_gross", "");
                                                                }
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="fixed_price_gross"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className={FORM_STYLES.label}>Precio Fijo (Bruto)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            className={cn(FORM_STYLES.input, "focus-visible:ring-primary")}
                                                            {...field}
                                                            value={field.value || ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                field.onChange(val);
                                                                if (val) {
                                                                    const net = PricingUtils.grossToNet(parseFloat(val));
                                                                    form.setValue("fixed_price", String(net));
                                                                } else {
                                                                    form.setValue("fixed_price", "");
                                                                }
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <div className="text-[10px] text-muted-foreground mt-1 text-right">
                                                        {ruleType === "PACKAGE_FIXED" ? "Precio TOTAL por el rango" : "Precio UNITARIO bruto"}
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                ) : (
                                    <FormField
                                        control={form.control}
                                        name="discount_percentage"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className={FORM_STYLES.label}>Descuento (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" className={cn(FORM_STYLES.input, "focus-visible:ring-primary")} {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="start_date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Fecha Inicio</FormLabel>
                                            <FormControl>
                                                <Input type="date" className={cn(FORM_STYLES.input, "focus-visible:ring-primary")} {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="end_date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Fecha Fin</FormLabel>
                                            <FormControl>
                                                <Input type="date" className={cn(FORM_STYLES.input, "focus-visible:ring-primary")} {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="active"
                                render={({ field }) => (
                                    <FormItem className={cn("flex flex-row items-start space-x-3 space-y-0", FORM_STYLES.card)}>
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className={FORM_STYLES.label}>Regla Activa</FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </form>
                    </Form>
                </div>

                {initialData?.id && (
                    <div className="w-72 border-l bg-muted/5 flex flex-col pt-4">
                        <ActivitySidebar
                            entityId={initialData.id}
                            entityType="pricing_rule"
                        />
                    </div>
                )}
            </div>
        </BaseModal>
    )
}

