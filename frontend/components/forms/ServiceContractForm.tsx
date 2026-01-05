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
    payment_day: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(31)),
    base_amount: z.string().transform((val) => parseFloat(val)).pipe(z.number().min(0)),
    is_amount_variable: z.boolean().default(false),
    start_date: z.string().min(1, "Fecha de inicio requerida"),
    end_date: z.string().optional(),
    auto_renew: z.boolean().default(false),
    expense_account: z.string().optional(), // Will be populated from category
    payable_account: z.string().optional(), // Will be populated from category
})

export function ServiceContractForm() {
    const router = useRouter()
    const [suppliers, setSuppliers] = useState([])
    const [categories, setCategories] = useState([])
    const [accounts, setAccounts] = useState([])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            recurrence_type: "MONTHLY",
            payment_day: 1,
            is_amount_variable: false,
            auto_renew: false,
        },
    })

    useEffect(() => {
        const loadData = async () => {
            try {
                const [supRes, catRes, accRes] = await Promise.all([
                    api.get('/contacts/?is_supplier=true'),
                    api.get('/services/categories/'),
                    api.get('/accounting/accounts/?account_type=EXPENSE,LIABILITY') // Ideally filter
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

    // Auto-fill accounts when category changes
    const onCategoryChange = (catId: string) => {
        form.setValue("category", catId)
        const cat: any = categories.find((c: any) => c.id.toString() === catId)
        if (cat) {
            if (cat.expense_account) form.setValue("expense_account", cat.expense_account.toString())
            if (cat.payable_account) form.setValue("payable_account", cat.payable_account.toString())
        }
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            await api.post("/services/contracts/", values)
            toast.success("Contrato creado exitosamente")
            router.push("/services/contracts")
        } catch (error: any) {
            console.error(error)
            toast.error(error.response?.data?.error || "Error al crear contrato")
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

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
                            <div className="grid grid-cols-2 gap-4">
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
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="recurrence_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Frecuencia</FormLabel>
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
                                            <FormLabel>Día de Pago</FormLabel>
                                            <FormControl><Input type="number" min={1} max={31} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="base_amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Monto Base</FormLabel>
                                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="is_amount_variable"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-8">
                                            <div className="space-y-0.5">
                                                <FormLabel>Monto Variable</FormLabel>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dates */}
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
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
                                            <FormDescription>Extender contrato automáticamente al finalizar</FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Accounting Hidden/Optional details */}
                    <Card>
                        <CardContent className="pt-6 space-y-4 opacity-50 hover:opacity-100 transition-opacity">
                            <h3 className="text-sm font-medium text-muted-foreground">Configuración Contable (Avanzado)</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="expense_account"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cuenta Gasto</FormLabel>
                                            <FormControl><Input {...field} readOnly placeholder="Heredado de categoría" /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="payable_account"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cuenta Pasivo</FormLabel>
                                            <FormControl><Input {...field} readOnly placeholder="Heredado de categoría" /></FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                </div>
                <Button type="submit" size="lg">Crear Contrato</Button>
            </form>
        </Form>
    )
}
