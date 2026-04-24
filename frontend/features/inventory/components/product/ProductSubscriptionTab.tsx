import { FormField } from "@/components/ui/form"
import { LabeledInput, LabeledSelect } from "@/components/shared"
import { Switch } from "@/components/ui/switch"
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
                {/* 1. Datos de Suscripción - Notched Container */}
                <div className="relative p-5 pt-8 rounded-lg border-2 bg-muted/5 shadow-sm border-primary/10">
                    <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Datos de Suscripción</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="subscription_supplier"
                            render={({ field, fieldState }) => (
                                <div className="space-y-1.5">
                                    <label className={FORM_STYLES.label}>Proveedor <span className="text-destructive">*</span></label>
                                    <AdvancedContactSelector
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        contactType="SUPPLIER"
                                        placeholder="Seleccionar proveedor..."
                                        disabled={isEditing}
                                    />
                                    {fieldState.error && <p className="text-[10px] text-destructive">{fieldState.error.message}</p>}
                                </div>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="subscription_start_date"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Fecha de Inicio"
                                    type="date"
                                    disabled={isEditing}
                                    error={fieldState.error?.message}
                                    hint={isEditing ? "Bloqueado tras activación." : "Inicio del servicio."}
                                    {...field}
                                    value={field.value || ""}
                                />
                            )}
                        />
                    </div>
                </div>

                {/* 2. Configuración de Recurrencia - Notched Container */}
                <div className="relative p-5 pt-8 rounded-lg border-2 bg-muted/5 shadow-sm border-primary/10">
                    <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Configuración de Recurrencia</span>
                    </div>

                    <div className="space-y-6">
                        <FormField
                            control={form.control}
                            name="recurrence_period"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Frecuencia de Cobro"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={[
                                        { label: "Semanal", value: "WEEKLY" },
                                        { label: "Mensual", value: "MONTHLY" },
                                        { label: "Trimestral", value: "QUARTERLY" },
                                        { label: "Semestral", value: "SEMIANNUAL" },
                                        { label: "Anual", value: "ANNUAL" }
                                    ]}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="payment_day_type"
                                render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Tipo de Fecha de Pago"
                                        value={field.value}
                                        onChange={field.onChange}
                                        options={[
                                            { label: "Cada N días", value: "INTERVAL" },
                                            { label: "Día fijo del mes", value: "FIXED_DAY" }
                                        ]}
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />

                            {form.watch("payment_day_type") === "FIXED_DAY" && (
                                <FormField
                                    control={form.control}
                                    name="payment_day"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Día del Mes"
                                            type="number"
                                            min={1}
                                            max={31}
                                            placeholder="Ej: 3"
                                            error={fieldState.error?.message}
                                            {...field}
                                            value={field.value ?? ""}
                                        />
                                    )}
                                />
                            )}

                            {form.watch("payment_day_type") === "INTERVAL" && (
                                <FormField
                                    control={form.control}
                                    name="payment_interval_days"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Intervalo de Días"
                                            type="number"
                                            min={1}
                                            placeholder="Ej: 90"
                                            error={fieldState.error?.message}
                                            {...field}
                                            value={field.value ?? ""}
                                        />
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-8">
                {/* 3. Configuración de Facturación - Notched Container */}
                <div className="relative p-5 pt-8 rounded-lg border-2 bg-muted/5 shadow-sm border-primary/10">
                    <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Facturación</span>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="default_invoice_type"
                                render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Doc. por Defecto"
                                        value={field.value}
                                        onChange={field.onChange}
                                        options={[
                                            { label: "Factura", value: "FACTURA" },
                                            { label: "Boleta", value: "BOLETA" }
                                        ]}
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="subscription_amount"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label={form.watch("is_variable_amount") ? "Referencia (Opcional)" : "Monto Fijo"}
                                        type="number"
                                        min={0}
                                        placeholder={form.watch("is_variable_amount") ? "Ej: 0" : "50000"}
                                        error={fieldState.error?.message}
                                        {...field}
                                        value={field.value ?? ""}
                                    />
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="is_variable_amount"
                            render={({ field }) => (
                                <div className="flex flex-row items-center justify-between rounded-md p-3 bg-background border border-primary/10">
                                    <div className="space-y-0.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Costo Variable</label>
                                        <p className="text-[10px] leading-tight text-muted-foreground/60">
                                            Activar si el costo cambia cada periodo.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </div>
                            )}
                        />
                    </div>
                </div>

                {/* 4. Mapeo Contable - Notched Container */}
                <div className="relative p-5 pt-8 rounded-lg border-2 bg-muted/5 shadow-sm border-primary/10">
                    <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Mapeo Contable</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="income_account"
                            render={({ field, fieldState }) => (
                                <div className="space-y-1.5">
                                    <label className={FORM_STYLES.label}>Ingreso (Haber) <span className="text-destructive">*</span></label>
                                    <AccountSelector
                                        value={field.value}
                                        onChange={field.onChange}
                                        accountType="INCOME"
                                        placeholder="Cuenta de ingreso..."
                                    />
                                    {fieldState.error && <p className="text-[10px] text-destructive">{fieldState.error.message}</p>}
                                </div>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="expense_account"
                            render={({ field, fieldState }) => (
                                <div className="space-y-1.5">
                                    <label className={FORM_STYLES.label}>Gasto/Costo (Debe) <span className="text-destructive">*</span></label>
                                    <AccountSelector
                                        value={field.value}
                                        onChange={field.onChange}
                                        accountType="EXPENSE"
                                        placeholder="Cuenta de gasto..."
                                    />
                                    {fieldState.error && <p className="text-[10px] text-destructive">{fieldState.error.message}</p>}
                                </div>
                            )}
                        />
                    </div>
                </div>

                {/* 5. Duración del Contrato - Notched Container */}
                <div className="relative p-5 pt-8 rounded-lg border-2 bg-muted/5 shadow-sm border-primary/10">
                    <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Vigencia</span>
                    </div>

                    <div className="space-y-6">
                        <FormField
                            control={form.control}
                            name="is_indefinite"
                            render={({ field }) => (
                                <div className="flex flex-row items-center justify-between rounded-md p-3 bg-background border border-primary/10">
                                    <div className="space-y-0.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contrato Indefinido</label>
                                        <p className="text-[10px] leading-tight text-muted-foreground/60">
                                            Sin fecha de cierre establecida.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </div>
                            )}
                        />

                        {!form.watch("is_indefinite") && (
                            <FormField
                                control={form.control}
                                name="contract_end_date"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Fecha de Finalización"
                                        type="date"
                                        error={fieldState.error?.message}
                                        {...field}
                                        value={field.value || ""}
                                    />
                                )}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
