"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Save } from "lucide-react"

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
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sales/settings/current/`)
            if (res.ok) {
                const data = await res.json()
                form.reset(data)
            }
        } catch (error) {
            console.error("Error fetching settings:", error)
            toast.error("Error al cargar configuración")
        } finally {
            setIsLoading(false)
        }
    }

    const onSubmit = async (data: SalesSettingsValues) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sales/settings/current/`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            })

            if (!res.ok) throw new Error("Error saving settings")

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
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Configuración de Ventas</h3>
                <p className="text-sm text-muted-foreground">
                    Gestiona las políticas y restricciones para el módulo de ventas y punto de venta.
                </p>
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
