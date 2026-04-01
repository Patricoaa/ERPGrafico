"use client"

import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { PricingRuleInitialData } from "@/types/forms"
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
import { Plus, Tags } from "lucide-react"
import { PricingUtils } from "@/lib/pricing"
import { ProductSelector } from "@/components/selectors/ProductSelector"

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
    auditSidebar?: React.ReactNode
    initialData?: PricingRuleInitialData
    onSuccess?: () => void
    open: boolean
    onOpenChange: (open: boolean) => void
    productId?: number
    productName?: string
}

export function PricingRuleForm({ auditSidebar,  initialData, onSuccess, open, onOpenChange, productId, productName }: PricingRuleFormProps) {
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
        } catch (error: unknown) {
            console.error(error)
            toast.error("Error al guardar la regla")
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size={initialData ? "xl" : "lg"}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Tags className="h-5 w-5 text-primary" />
                    </div>
                    <span>{initialData ? "Ficha de Regla de Precio" : "Nueva Regla de Precio"}</span>
                </div>
            }
            description={
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {initialData?.rule_type && (
                        <>
                            <span>{initialData.rule_type === "FIXED" ? "Monto Fijo" : initialData.rule_type === "PACKAGE_FIXED" ? "Paquete Fijo" : "Descuento"}</span>
                            <span className="opacity-30">|</span>
                        </>
                    )}
                    <span>{form.watch("name") || "Configuración de regla activa"}</span>
                </div>
            }
            footer={
                <div className="flex justify-end space-x-2 w-full">
                    <Button type="submit" form="pricing-rule-form">
                        {initialData ? "Actualizar" : "Crear"} Regla
                    </Button>
                </div>
            }
        >
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-y-auto pt-4 scrollbar-thin">
                    <Form {...form}>
                        <form id="pricing-rule-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pr-6 pl-1 pb-4">
                            {/* Section 1: Scope & Basic Info */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pt-2">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Alcance y Referencia</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="col-span-3">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className={FORM_STYLES.label}>Nombre de la Regla</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ej: Descuento Mayorista" className={FORM_STYLES.input} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <FormField
                                            control={form.control}
                                            name="priority"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className={FORM_STYLES.label}>Prioridad</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" className={FORM_STYLES.input} {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="product"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className={FORM_STYLES.label}>Producto Específico (Opcional)</FormLabel>
                                                <FormControl>
                                                    <ProductSelector
                                                        value={field.value?.toString() || null}
                                                        onChange={(val) => field.onChange(val ? parseInt(val) : null)}
                                                        disabled={!!productId}
                                                        placeholder="Si no se selecciona, aplica a todos"
                                                    />
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
                                                <FormLabel className={FORM_STYLES.label}>Unidad de Medida (Filtro)</FormLabel>
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
                            </div>

                            {/* Section 2: Trigger Condition */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pt-2">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Condición de Activación</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>
                                <div className={cn("grid gap-4", operator === "BT" ? "grid-cols-3" : "grid-cols-2")}>
                                    <FormField
                                        control={form.control}
                                        name="operator"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className={FORM_STYLES.label}>Cuando la Cantidad es...</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className={FORM_STYLES.input}>
                                                            <SelectValue placeholder="Operador" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="GE">Mayor o Igual ( {">="} )</SelectItem>
                                                        <SelectItem value="GT">Mayor que ( {">"} )</SelectItem>
                                                        <SelectItem value="LE">Menor o Igual ( {"<="} )</SelectItem>
                                                        <SelectItem value="LT">Menor que ( {"<"} )</SelectItem>
                                                        <SelectItem value="EQ">Igual a ( = )</SelectItem>
                                                        <SelectItem value="BT">En el Rango (Entre)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="min_quantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className={FORM_STYLES.label}>{operator === "BT" ? "Desde" : "Cantidad"}</FormLabel>
                                                <FormControl>
                                                    <Input type="number" className={FORM_STYLES.input} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {operator === "BT" && (
                                        <FormField
                                            control={form.control}
                                            name="max_quantity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className={FORM_STYLES.label}>Hasta</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" className={FORM_STYLES.input} {...field} value={field.value || ""} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Section 3: Result Action */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pt-2">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Efecto / Precio Final</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="rule_type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className={FORM_STYLES.label}>Tipo de Ajuste</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className={FORM_STYLES.input}>
                                                            <SelectValue placeholder="Seleccione tipo" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="FIXED">Precio Unitario Fijo</SelectItem>
                                                        <SelectItem value="PACKAGE_FIXED">Precio de Paquete (Total)</SelectItem>
                                                        <SelectItem value="DISCOUNT_PERCENTAGE">Porcentaje Descuento</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {ruleType === "DISCOUNT_PERCENTAGE" ? (
                                        <FormField
                                            control={form.control}
                                            name="discount_percentage"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className={FORM_STYLES.label}>Descuento (%)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" className={FORM_STYLES.input} {...field} value={field.value || ""} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            <FormField
                                                control={form.control}
                                                name="fixed_price"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className={FORM_STYLES.label}>Precio (Neto)</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                className={FORM_STYLES.input}
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
                                                        <FormLabel className={FORM_STYLES.label}>Precio (Bruto)</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                className={FORM_STYLES.input}
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
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section 4: Period & Status */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pt-2">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Vigencia y Estado</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="start_date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className={FORM_STYLES.label}>Válida Desde</FormLabel>
                                                <FormControl>
                                                    <Input type="date" className={FORM_STYLES.input} {...field} value={field.value || ""} />
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
                                            <FormLabel className={FORM_STYLES.label}>Válida Hasta (Opcional)</FormLabel>
                                            <FormControl>
                                                <Input type="date" className={FORM_STYLES.input} {...field} value={field.value || ""} />
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
                                    <FormItem className={cn("flex flex-row items-center space-x-3 space-y-0 p-4 border rounded-xl bg-muted/5")}>
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className="text-sm font-bold">La regla se encuentra activa</FormLabel>
                                            <p className="text-xs text-muted-foreground">Si está desactivada, el sistema la omitirá incluso si se cumplen las condiciones.</p>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </div>
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
    )
}

