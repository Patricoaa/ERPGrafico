"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"

const formSchema = z.object({
    name: z.string().min(2, "El nombre es muy corto"),
    description: z.string().optional(),
    supplier: z.string().min(1, "Debe seleccionar proveedor"),
    category: z.string().min(1, "Debe seleccionar categoría"),
    recurrence_type: z.string().default("MONTHLY"),
    payment_day: z.coerce.number().min(1).max(31),
    base_amount: z.coerce.number().min(0),
    is_amount_variable: z.boolean().default(false),
    start_date: z.string().min(1, "Fecha de inicio requerida"),
    end_date: z.string().optional(),
    auto_renew: z.boolean().default(false),
    expense_account: z.string().optional(), // Will be populated from category
    payable_account: z.string().optional(), // Will be populated from category
})

interface ServiceContractFormProps {
    onSuccess?: () => void
    initialData?: any
}

export function ServiceContractForm({ onSuccess, initialData }: ServiceContractFormProps) {
    const router = useRouter()
    const [suppliers, setSuppliers] = useState([])
    const [categories, setCategories] = useState([])
    const [accounts, setAccounts] = useState([])

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            recurrence_type: "MONTHLY",
            payment_day: 1,
            is_amount_variable: false,
            auto_renew: false,
            expense_account: "inherited",
            payable_account: "inherited",
            ...initialData
        },
    })

    // Update defaults if initialData loads later (though usually passed fully formed)
    useEffect(() => {
        if (initialData) {
            form.reset({
                recurrence_type: "MONTHLY",
                payment_day: 1,
                is_amount_variable: false,
                auto_renew: false,
                ...initialData,
                // Ensure IDs are strings for Select components
                supplier: initialData.supplier?.toString(),
                category: initialData.category?.toString(),
                expense_account: initialData.expense_account?.toString() || "inherited",
                payable_account: initialData.payable_account?.toString() || "inherited",
            })
        }
    }, [initialData, form])

    useEffect(() => {
        const loadData = async () => {
            try {
                const [supRes, catRes, accRes] = await Promise.all([
                    api.get('/contacts/?is_supplier=true'),
                    api.get('/services/categories/'),
                    api.get('/accounting/accounts/?account_type=EXPENSE,LIABILITY&is_leaf=true') // Filter leaf accounts
                ])
                setSuppliers(supRes.data.results || supRes.data)
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

    async function onSubmit(values: z.infer<typeof formSchema>) {
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
        } catch (error: any) {
            console.error(error)
            toast.error(error.response?.data?.error || "Error al guardar contrato")
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
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre del Servicio</FormLabel>
                                        <FormControl><Input placeholder="Ej: Arriendo Oficina" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descripción</FormLabel>
                                        <FormControl><Textarea {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="supplier"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Proveedor</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {suppliers.map((s: any) => (
                                                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Categoría</FormLabel>
                                            <Select onValueChange={onCategoryChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {categories.map((c: any) => (
                                                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
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
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Frecuencia de Facturación</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="MONTHLY">Mensual</SelectItem>
                                                    <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                                                    <SelectItem value="ANNUAL">Anual</SelectItem>
                                                    <SelectItem value="ONE_TIME">Único</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="payment_day"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Día de Pago sugerido</FormLabel>
                                            <FormControl><Input type="number" min={1} max={31} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="base_amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Monto Base</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    {...field}
                                                    disabled={form.watch("is_amount_variable")}
                                                    className={form.watch("is_amount_variable") ? "bg-muted" : ""}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="is_amount_variable"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-sm">Monto Variable</FormLabel>
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
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Fecha Inicio</FormLabel>
                                                <FormControl><Input type="date" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="end_date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Fecha Término</FormLabel>
                                                <FormControl><Input type="date" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="auto_renew"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel>Renovación Automática</FormLabel>
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
                        <Card className="border-indigo-100 bg-indigo-50/10">
                            <CardContent className="pt-6 space-y-4">
                                <h3 className="text-sm font-semibold text-indigo-900 border-b pb-2 flex justify-between items-center">
                                    Configuración Contable
                                    <span className="text-[10px] font-normal text-muted-foreground uppercase">Avanzado</span>
                                </h3>
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="expense_account"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Cuenta Gasto</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || "inherited"}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Heredado" /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="inherited" className="font-semibold text-indigo-600 italic">Heredar de categoría (Recomendado)</SelectItem>
                                                        {accounts.filter((a: any) => a.account_type === 'EXPENSE').map((a: any) => (
                                                            <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="payable_account"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Cuenta Pasivo / Provisión</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || "inherited"}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Heredado" /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="inherited" className="font-semibold text-indigo-600 italic">Heredar de categoría (Recomendado)</SelectItem>
                                                        {accounts.filter((a: any) => a.account_type === 'LIABILITY').map((a: any) => (
                                                            <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                </div>
                <Button type="submit" size="lg">{initialData ? 'Actualizar Contrato' : 'Crear Contrato'}</Button>
            </form>
        </Form>
    )
}
