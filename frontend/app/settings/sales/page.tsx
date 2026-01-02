"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Save, ChevronLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

const salesSettingsSchema = z.object({
    restrict_stock_sales: z.boolean().default(false),
})

type SalesSettingsValues = z.infer<typeof salesSettingsSchema>

export default function SalesSettingsPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)

    const form = useForm<SalesSettingsValues>({
        resolver: zodResolver(salesSettingsSchema),
        defaultValues: {
            restrict_stock_sales: false,
        },
    })

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await api.get('/sales/settings/current/')
            form.reset(res.data)
        } catch (error) {
            console.error("Error fetching settings:", error)
            toast.error("Error al cargar configuración")
        } finally {
            setIsLoading(false)
        }
    }

    const onSubmit = async (data: SalesSettingsValues) => {
        try {
            await api.patch('/sales/settings/current/', data)
            toast.success("Configuración guardada exitosamente")
        } catch (error) {
            console.error("Error saving settings:", error)
            toast.error("Error al guardar configuración")
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Configuración de Ventas</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestiona las políticas y restricciones para el módulo de ventas y punto de venta.
                    </p>
                </div>
            </div>

            <Separator />

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Políticas de Stock</CardTitle>
                            <CardDescription>
                                Controla cómo se comporta el sistema frente a la disponibilidad de productos.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="restrict_stock_sales"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                                        <div className="space-y-0.5">
                                            <FormLabel>Restringir Ventas Sin Stock</FormLabel>
                                            <FormDescription>
                                                Si se activa, el sistema impedirá confirmar ventas o realizar cobros en el POS si no hay suficiente stock disponible para los productos almacenables.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Button type="submit">
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Cambios
                    </Button>
                </form>
            </Form>
        </div>
    )
}
