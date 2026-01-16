
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { CalendarClock, DollarSign, Users, Calendar } from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"

interface ProductSubscriptionTabProps {
    form: UseFormReturn<ProductFormValues>
}

export function ProductSubscriptionTab({ form }: ProductSubscriptionTabProps) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Configuración de Recurrencia */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CalendarClock className="h-5 w-5 text-primary" />
                            Configuración de Recurrencia
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="recurrence_period"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Frecuencia de Cobro</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione frecuencia" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="WEEKLY">Semanal</SelectItem>
                                            <SelectItem value="MONTHLY">Mensual</SelectItem>
                                            <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                                            <SelectItem value="SEMIANNUAL">Semestral</SelectItem>
                                            <SelectItem value="ANNUAL">Anual</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Define cada cuánto se debe generar la obligación de pago.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="is_variable_amount"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Monto Variable</FormLabel>
                                        <FormDescription>
                                            Activar si el costo cambia cada periodo (ej: Luz, Agua).
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

                {/* Configuración de Fecha de Pago */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CalendarClock className="h-5 w-5 text-primary" />
                            Configuración de Fecha de Pago
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="payment_day_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Fecha de Pago</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione tipo..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="INTERVAL">Cada N días</SelectItem>
                                            <SelectItem value="FIXED_DAY">Día fijo del mes</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Define si el pago es cada cierta cantidad de días o un día específico del mes.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {form.watch("payment_day_type") === "FIXED_DAY" && (
                            <FormField
                                control={form.control}
                                name="payment_day"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Día del Mes</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={31}
                                                placeholder="Ej: 3"
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Día del mes para realizar el pago (1-31).
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {form.watch("payment_day_type") === "INTERVAL" && (
                            <FormField
                                control={form.control}
                                name="payment_interval_days"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Intervalo de Días</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={1}
                                                placeholder="Ej: 90"
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Cantidad de días entre cada pago.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* Configuración de Facturación */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <DollarSign className="h-5 w-5 text-primary" />
                            Configuración de Facturación
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="default_invoice_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Documento por Defecto</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione tipo..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="FACTURA">Factura</SelectItem>
                                            <SelectItem value="BOLETA">Boleta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Tipo de documento a usar en renovaciones automáticas.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Duración del Contrato */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Calendar className="h-5 w-5 text-primary" />
                            Duración del Contrato
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="is_indefinite"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Suscripción Indefinida</FormLabel>
                                        <FormDescription>
                                            La suscripción no tiene fecha de finalización.
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

                        {!form.watch("is_indefinite") && (
                            <FormField
                                control={form.control}
                                name="contract_end_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha de Finalización</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Fecha en que finaliza el contrato.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* Activación de Suscripción */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Users className="h-5 w-5 text-primary" />
                            Activación de Suscripción
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="subscription_supplier"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Proveedor</FormLabel>
                                        <FormControl>
                                            <AdvancedContactSelector
                                                value={field.value}
                                                onChange={field.onChange}
                                                contactType="SUPPLIER"
                                                placeholder="Seleccionar proveedor..."
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Proveedor de la suscripción.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="subscription_amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {form.watch("is_variable_amount") ? "Monto de Referencia" : "Monto Fijo"}
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder={form.watch("is_variable_amount") ? "Ej: 0" : "50000"}
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            {form.watch("is_variable_amount")
                                                ? "Monto base estimado (puede ser 0)."
                                                : "Monto periódico de la suscripción."}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="subscription_start_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha de Inicio</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Cuándo comienza el servicio.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="auto_activate_subscription"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-primary/5">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Activar Producto Inmediatamente</FormLabel>
                                        <FormDescription>
                                            <strong>ON:</strong> Crea la suscripción activa ahora al guardar.<br />
                                            <strong>OFF:</strong> Espera a recibir una Orden de Compra para activarse.
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
            </div>
        </div>
    )
}
