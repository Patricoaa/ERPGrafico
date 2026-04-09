import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-12 gap-y-8">
            {/* LEFT COLUMN */}
            <div className="space-y-8">
                {/* 1. Datos de Suscripción */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pt-2 pb-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> Datos de Suscripción
                        </span>
                        <div className="flex-1 h-px bg-border" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="subscription_supplier"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Proveedor <span className="text-destructive">*</span></FormLabel>
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
                                    <FormLabel className={FORM_STYLES.label}>Fecha de Inicio <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                            value={field.value || ""}
                                            disabled={isEditing}
                                            className={FORM_STYLES.input}
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

                {/* 2. Configuración de Recurrencia */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pt-2 pb-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" /> Configuración de Recurrencia
                        </span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    <FormField
                        control={form.control}
                        name="recurrence_period"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Frecuencia de Cobro <span className="text-destructive">*</span></FormLabel>
                                <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    value={field.value}
                                >
                                    <FormControl>
                                        <SelectTrigger className={FORM_STYLES.input}>
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

                    {/* Controles variables de día de cobro */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="payment_day_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Tipo de Fecha de Pago <span className="text-destructive">*</span></FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className={FORM_STYLES.input}>
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
                                        <FormLabel className={FORM_STYLES.label}>Día del Mes <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={31}
                                                placeholder="Ej: 3"
                                                className={FORM_STYLES.input}
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
                                        <FormLabel className={FORM_STYLES.label}>Intervalo de Días <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={1}
                                                placeholder="Ej: 90"
                                                className={FORM_STYLES.input}
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
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-8">
                {/* 3. Configuración de Facturación */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pt-2 pb-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3 w-3" /> Configuración de Facturación
                        </span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="default_invoice_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Doc. por Defecto <span className="text-destructive">*</span></FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className={FORM_STYLES.input}>
                                                <SelectValue placeholder="Seleccione..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="FACTURA">Factura</SelectItem>
                                            <SelectItem value="BOLETA">Boleta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="subscription_amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>
                                        {form.watch("is_variable_amount") ? "Referencia (Opcional)" : "Monto Fijo"} {!form.watch("is_variable_amount") && <span className="text-destructive">*</span>}
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                className={cn(FORM_STYLES.input, "pl-7")}
                                                placeholder={form.watch("is_variable_amount") ? "Ej: 0" : "50000"}
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                                value={field.value ?? ""}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="is_variable_amount"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg p-4 bg-muted/5">
                                <div className="space-y-0.5">
                                    <FormLabel className={FORM_STYLES.label}>Costo Variable</FormLabel>
                                    <FormDescription className="text-[10px] leading-tight">
                                        Activar si el costo cambia cada periodo (e.g. Luz, Agua).
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
                </div>

                {/* 4. Mapeo Contable */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pt-2 pb-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3 w-3" /> Mapeo Contable (Suscripción)
                        </span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="income_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Ingreso (Haber) <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <AccountSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            accountType="INCOME"
                                            placeholder="Cuenta de ingreso..."
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="expense_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Gasto/Costo (Debe) <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <AccountSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            accountType="EXPENSE"
                                            placeholder="Cuenta de gasto..."
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* 5. Duración del Contrato */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pt-2 pb-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Duración del Contrato
                        </span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    <FormField
                        control={form.control}
                        name="is_indefinite"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg p-4 bg-muted/5">
                                <div className="space-y-0.5">
                                    <FormLabel className={FORM_STYLES.label}>Contrato Indefinido</FormLabel>
                                    <FormDescription className="text-[10px] leading-tight">
                                        Renovación sin fecha de cierre.
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
                                    <FormLabel className={FORM_STYLES.label}>Fecha de Finalización <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                            value={field.value || ""}
                                            className={FORM_STYLES.input}
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
