import { Button } from "@/components/ui/button"
import { BaseModal } from "@/components/shared/BaseModal"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useEffect } from "react"
import { z } from "zod"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"

const ruleSchema = z.object({
    id: z.number().optional(),
    warehouse: z.string().min(1, "Seleccione un almacén"),
    min_quantity: z.number().min(0, "La cantidad mínima no puede ser negativa"),
    max_quantity: z.number().min(0, "La cantidad máxima no puede ser negativa"),
})

type RuleFormValues = z.infer<typeof ruleSchema>

interface ReplenishmentRuleFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: (rule: any) => void
    initialData?: any
    warehouses: any[]
}

export function ReplenishmentRuleForm({ open, onOpenChange, onSave, initialData, warehouses }: ReplenishmentRuleFormProps) {
    const form = useForm<RuleFormValues>({
        resolver: zodResolver(ruleSchema),
        defaultValues: {
            warehouse: "",
            min_quantity: 0,
            max_quantity: 0,
        },
    })

    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    id: initialData.id,
                    warehouse: initialData.warehouse?.toString() || "",
                    min_quantity: parseFloat(initialData.min_quantity) || 0,
                    max_quantity: parseFloat(initialData.max_quantity) || 0,
                })
            } else {
                form.reset({
                    warehouse: "",
                    min_quantity: 0,
                    max_quantity: 0,
                })
            }
        }
    }, [open, initialData, form])

    const onSubmit = (data: RuleFormValues) => {
        onSave(data)
        onOpenChange(false)
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="md"
            hideScrollArea={true}
            contentClassName="p-0"
            title={initialData ? "Editar Regla" : "Nueva Regla de Reabastecimiento"}
            className={initialData ? 'h-[500px]' : ''}
            footer={
                <>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="replenishment-rule-form">Guardar</Button>
                </>
            }
        >
            <div className="flex shrink-0 overflow-hidden h-full">
                <div className="flex-1 space-y-4 p-6">
                    <Form {...form}>
                        <form id="replenishment-rule-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="warehouse"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Almacén</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione almacén" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {warehouses.map((w) => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>
                                                        {w.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="min_quantity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cantidad Mínima</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.0001"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="max_quantity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cantidad Máxima</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.0001"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </form>
                    </Form>
                </div>

                {initialData?.id && (
                    <div className="w-80 border-l bg-muted/5 ml-6 -my-6 py-6 px-6 flex flex-col overflow-hidden">
                        <ActivitySidebar
                            entityId={initialData.id}
                            entityType="reordering_rule"
                        />
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
