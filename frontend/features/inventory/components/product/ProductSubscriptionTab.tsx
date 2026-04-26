import { FormField } from "@/components/ui/form"
import { LabeledInput, LabeledSelect, LabeledContainer, PeriodValidationDateInput, FormSection, FormTabsContent } from "@/components/shared"
import { Switch } from "@/components/ui/switch"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { CalendarClock, DollarSign, Users, Calendar, Wallet, FileText } from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { cn } from "@/lib/utils"

interface ProductSubscriptionTabProps {
    form: UseFormReturn<ProductFormValues>
    isEditing?: boolean
}

export function ProductSubscriptionTab({ form, isEditing }: ProductSubscriptionTabProps) {
    return (
        <FormTabsContent value="subscription" className="mt-0 space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-4 gap-x-8 gap-y-10 items-start">
                {/* 1. Subscription Setup */}
                <div className="col-span-2 space-y-4">
                    <FormSection title="Configuración de Servicio" icon={CalendarClock} />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <FormField
                                control={form.control}
                                name="subscription_supplier"
                                render={({ field, fieldState }) => (
                                    <LabeledContainer label="Proveedor" error={fieldState.error?.message}>
                                        <div className="h-[34px]">
                                            <AdvancedContactSelector
                                                value={field.value || ""}
                                                onChange={field.onChange}
                                                contactType="SUPPLIER"
                                                placeholder="Buscar..."
                                                disabled={isEditing}
                                                className="border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent h-full px-3 text-xs font-black uppercase"
                                            />
                                        </div>
                                    </LabeledContainer>
                                )}
                            />
                        </div>

                        <div className="col-span-1">
                            <FormField
                                control={form.control}
                                name="subscription_start_date"
                                render={({ field, fieldState }) => (
                                    <PeriodValidationDateInput
                                        date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                                        onDateChange={(date) => {
                                            if (!date) {
                                                field.onChange(null)
                                                return
                                            }
                                            field.onChange(date.toISOString().split('T')[0])
                                        }}
                                        label="Fecha Inicio"
                                        disabled={isEditing}
                                        validationType="tax"
                                    />
                                )}
                            />
                        </div>

                        <div className="col-span-2">
                            <FormField
                                control={form.control}
                                name="recurrence_period"
                                render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Frecuencia de Facturación"
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
                        </div>

                        <div className="col-span-1">
                            <FormField
                                control={form.control}
                                name="payment_day_type"
                                render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Método de Ciclo"
                                        value={field.value}
                                        onChange={field.onChange}
                                        options={[
                                            { label: "Intervalo Días", value: "INTERVAL" },
                                            { label: "Día Fijo", value: "FIXED_DAY" }
                                        ]}
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />
                        </div>

                        <div className="col-span-1">
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
                                            error={fieldState.error?.message}
                                            {...field}
                                            value={field.value ?? ""}
                                            className="h-[34px] font-mono font-black"
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
                                            label="Cada N días"
                                            type="number"
                                            min={1}
                                            error={fieldState.error?.message}
                                            {...field}
                                            value={field.value ?? ""}
                                            className="h-[34px] font-mono font-black"
                                        />
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Financials */}
                <div className="col-span-2 space-y-4">
                    <FormSection title="Condiciones y Cuentas" icon={Wallet} />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <FormField
                                control={form.control}
                                name="default_invoice_type"
                                render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Tipo Documento"
                                        value={field.value}
                                        onChange={field.onChange}
                                        options={[
                                            { label: "Factura (A)", value: "FACTURA" },
                                            { label: "Boleta (B)", value: "BOLETA" }
                                        ]}
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />
                        </div>

                        <div className="col-span-1">
                            <FormField
                                control={form.control}
                                name="subscription_amount"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Monto Cuota"
                                        type="number"
                                        min={0}
                                        error={fieldState.error?.message}
                                        {...field}
                                        value={field.value ?? ""}
                                        className="h-[34px] font-mono font-black"
                                        icon={<DollarSign className="h-3 w-3 opacity-40" />}
                                    />
                                )}
                            />
                        </div>

                        <div className="col-span-2">
                            <FormField
                                control={form.control}
                                name="is_variable_amount"
                                render={({ field }) => (
                                    <div className="flex items-center justify-between p-3 rounded-xl border border-primary/10 bg-background/50">
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest">Costo Variable</label>
                                            <p className="text-[9px] text-muted-foreground italic">El monto se ajusta según consumo cada periodo.</p>
                                        </div>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </div>
                                )}
                            />
                        </div>

                        <div className="col-span-1">
                                <FormField
                                    control={form.control}
                                    name="income_account"
                                    render={({ field, fieldState }) => (
                                        <AccountSelector
                                            label="Cuenta Ingreso"
                                            error={fieldState.error?.message}
                                            value={field.value}
                                            onChange={field.onChange}
                                            accountType="INCOME"
                                            placeholder="Sel. cuenta..."
                                        />
                                    )}
                                />
                        </div>

                        <div className="col-span-1">
                                <FormField
                                    control={form.control}
                                    name="expense_account"
                                    render={({ field, fieldState }) => (
                                        <AccountSelector
                                            label="Cuenta Gasto"
                                            error={fieldState.error?.message}
                                            value={field.value}
                                            onChange={field.onChange}
                                            accountType="EXPENSE"
                                            placeholder="Sel. cuenta..."
                                        />
                                    )}
                                />
                        </div>

                        {/* Validity Section integrated into Grid */}
                        <div className="col-span-2 mt-4 space-y-4">
                            <FormSection title="Vigencia de Contrato" icon={Calendar} />
                            <FormField
                                control={form.control}
                                name="is_indefinite"
                                render={({ field }) => (
                                    <div className="flex items-center justify-between p-3 rounded-xl border border-warning/20 bg-warning/5">
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-warning-700">Contrato Indefinido</label>
                                            <p className="text-[9px] text-warning-600/60 italic">Renovación automática hasta cancelación manual.</p>
                                        </div>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </div>
                                )}
                            />

                            {!form.watch("is_indefinite") && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <FormField
                                        control={form.control}
                                        name="contract_end_date"
                                        render={({ field, fieldState }) => (
                                            <PeriodValidationDateInput
                                                date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                                                onDateChange={(date) => {
                                                    if (!date) {
                                                        field.onChange(null)
                                                        return
                                                    }
                                                    field.onChange(date.toISOString().split('T')[0])
                                                }}
                                                label="Fecha Término"
                                                validationType="tax"
                                            />
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </FormTabsContent>
    )
}
