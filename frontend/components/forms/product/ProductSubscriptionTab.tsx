
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { CalendarClock, DollarSign, Users, Calendar } from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface ProductSubscriptionTabProps {
    form: UseFormReturn<ProductFormValues>
    isEditing?: boolean
}

export function ProductSubscriptionTab({ form, isEditing }: ProductSubscriptionTabProps) {
    return (
        <div className="space-y-6">
            {/* 1. Activación de Suscripción (Ahora primero) */}
            <div className="p-6 rounded-2xl border bg-card/50 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                    <Users className="h-4 w-4" />
                    Datos de Suscripción
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="subscription_supplier"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Proveedor <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <AdvancedContactSelector
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            contactType="SUPPLIER"
                                            placeholder="Seleccionar proveedor..."
                                            disabled={isEditing}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        {isEditing ? "El proveedor no puede cambiarse una vez activa." : "Proveedor de la suscripción."}
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
                                    <FormLabel>Fecha de Inicio <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                            value={field.value || ""}
                                            disabled={isEditing}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        {isEditing ? "Fecha inicial del servicio (Bloqueado)." : "Cuándo comienza el servicio."}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 2. Configuración de Recurrencia */}
                <div className="p-6 rounded-2xl border bg-card/50 space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                        <CalendarClock className="h-4 w-4" />
                        Configuración de Recurrencia
                    </h3>
                        <FormField
                            control={form.control}
                            name="recurrence_period"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Frecuencia de Cobro <span className="text-destructive">*</span></FormLabel>
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

                        {/* Configuración de Fecha de Pago (dentro de Recurrencia para ahorrar espacio) */}
                        <div className="pt-4 border-t space-y-4">
                            <FormField
                                control={form.control}
                                name="payment_day_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Fecha de Pago <span className="text-destructive">*</span></FormLabel>
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
                                            <FormLabel>Día del Mes <span className="text-destructive">*</span></FormLabel>
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
                                            <FormLabel>Intervalo de Días <span className="text-destructive">*</span></FormLabel>
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
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                </div>

                {/* 3. Configuración de Facturación */}
                <div className="p-6 rounded-2xl border bg-card/50 space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                        <DollarSign className="h-4 w-4" />
                        Configuración de Facturación
                    </h3>
                        <FormField
                            control={form.control}
                            name="default_invoice_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Documento por Defecto <span className="text-destructive">*</span></FormLabel>
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
                                        Tipo usado en renovaciones automáticas.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Monto Variable movido aquí */}
                        <FormField
                            control={form.control}
                            name="is_variable_amount"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/30">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Monto Variable</FormLabel>
                                        <FormDescription className="text-xs">
                                            Activar si el costo cambia cada periodo (Luz, Agua).
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

                        <FormField
                            control={form.control}
                            name="subscription_amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        {form.watch("is_variable_amount") ? "Monto de Referencia (Opcional)" : "Monto Fijo"} {!form.watch("is_variable_amount") && <span className="text-destructive">*</span>}
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                className="pl-7"
                                                placeholder={form.watch("is_variable_amount") ? "Ej: 0" : "50000"}
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                                value={field.value ?? ""}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormDescription>
                                        {form.watch("is_variable_amount")
                                            ? "Monto base estimado. Opcional para suscripciones variables."
                                            : "Monto periódico de la suscripción."}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                </div>

                {/* 4. Configuración Contable (Haber / Debe) */}
                <div className="p-6 rounded-2xl border bg-card/50 space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                        <DollarSign className="h-4 w-4" />
                        Mapeo Contable de Suscripción
                    </h3>
                        <FormField
                            control={form.control}
                            name="income_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Ingreso (Haber) <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <AccountSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            accountType="INCOME"
                                            placeholder="Cuenta de ventas por suscripción..."
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[10px]">
                                        Donde se registrará el ingreso por este concepto.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="expense_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Gasto/Costo (Debe) <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <AccountSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            accountType="EXPENSE"
                                            placeholder="Cuenta de gasto por suscripción..."
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[10px]">
                                        Donde se registrará el gasto asociado.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                </div>

                {/* 5. Duración del Contrato */}
                <div className="p-6 rounded-2xl border bg-card/50 space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                        <Calendar className="h-4 w-4" />
                        Duración del Contrato
                    </h3>
                        <FormField
                            control={form.control}
                            name="is_indefinite"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Suscripción Indefinida</FormLabel>
                                        <FormDescription>
                                            No tiene fecha de finalización.
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
                                        <FormLabel>Fecha de Finalización <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                </div>
            </div>
        </div>
    )
}
