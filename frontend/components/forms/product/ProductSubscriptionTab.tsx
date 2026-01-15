
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { CalendarClock, AlertTriangle, DollarSign, Wallet } from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"

interface ProductSubscriptionTabProps {
    form: UseFormReturn<ProductFormValues>
}

export function ProductSubscriptionTab({ form }: ProductSubscriptionTabProps) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            name="renewal_notice_days"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Días de Aviso Renovación</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                className="pl-8"
                                                min={0}
                                                {...field}
                                            />
                                            <AlertTriangle className="h-4 w-4 absolute left-2.5 top-3 text-muted-foreground" />
                                        </div>
                                    </FormControl>
                                    <FormDescription>
                                        Días antes del vencimiento para alertar.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <DollarSign className="h-5 w-5 text-primary" />
                            Detalles del Costo
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
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

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Wallet className="h-5 w-5 text-primary" />
                            Configuración Contable
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="expense_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Gasto (Personalizada)</FormLabel>
                                    <FormControl>
                                        <AccountSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            accountType="EXPENSE"
                                            placeholder="Cuenta de gasto por defecto..."
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Mapeo contable específico para este producto.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="income_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Ingreso (Personalizada)</FormLabel>
                                    <FormControl>
                                        <AccountSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            accountType="INCOME"
                                            placeholder="Cuenta de ingreso por defecto..."
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Mapeo contable específico para este producto.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
