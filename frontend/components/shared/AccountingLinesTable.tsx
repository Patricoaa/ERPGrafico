"use client"

import { useFieldArray, useWatch, Control } from "react-hook-form"
import { Trash2 } from "lucide-react"
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import {
    FormField,
    FormItem,
    FormControl,
    FormMessage,
} from "@/components/ui/form"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { LabeledInput, IconButton } from "@/components/shared"
import { FormLineItemsTable } from "@/components/shared/FormLineItemsTable"
import { cn } from "@/lib/utils"

const tableInputClass = "h-8 w-full bg-background border border-border/80 rounded-md px-2 text-xs focus:border-primary/40 focus:outline-none transition-all disabled:opacity-50"

// ─────────────────────────────────────────────────────────
// Balance footer
// ─────────────────────────────────────────────────────────

const TotalBalance = ({ control, name }: { control: Control<any>; name: string }) => {
    const items = useWatch({ control, name })

    const totalDebit = items?.reduce((sum: number, item: any) => sum + (Number(item.debit) || 0), 0) || 0
    const totalCredit = items?.reduce((sum: number, item: any) => sum + (Number(item.credit) || 0), 0) || 0
    const diff = totalDebit - totalCredit
    const isBalanced = Math.abs(diff) < 0.01

    return (
        <div className={cn("flex flex-col items-end text-sm font-medium", isBalanced ? "text-success" : "text-destructive")}>
            <span>Total Debe: {totalDebit.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}</span>
            <span>Total Haber: {totalCredit.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}</span>
            {!isBalanced && (
                <span>Diferencia: {diff.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}</span>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────

interface AccountingLinesTableProps {
    /** Control from react-hook-form */
    control: Control<any>
    /** Name of the field array in the form schema */
    name: string
    /** Loading state */
    isLoading?: boolean
}

// ─────────────────────────────────────────────────────────
// Column definition (shared constant)
// ─────────────────────────────────────────────────────────

const COLUMNS = [
    { header: "Cuenta",  width: "w-[300px]", align: "center" as const },
    { header: "Glosa",                        align: "center" as const },
    { header: "Debe",   width: "w-[150px]",   align: "center" as const },
    { header: "Haber",  width: "w-[150px]",   align: "center" as const },
    { header: "",       width: "w-[50px]" },
]

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

/**
 * **AccountingLinesTable**
 *
 * Specialized table for entering double-entry accounting journal lines.
 * Wraps `FormLineItemsTable` and injects AccountSelector, glosa input,
 * debit/credit numeric inputs, and a real-time balance footer.
 *
 * Used for:
 * - Direct journal entries (`JournalEntryForm`)
 * - Payment registrations with accounting impacts
 * - Manual accounting adjustments
 */
export function AccountingLinesTable({ control, name, isLoading }: AccountingLinesTableProps) {
    const { fields, append, remove } = useFieldArray({ control, name })

    return (
        <FormLineItemsTable
            columns={COLUMNS}
            onAdd={() => append({ account: "", label: "", debit: 0, credit: 0 })}
            addButtonText="Agregar Línea"
            footer={<TotalBalance control={control} name={name} />}
            isLoading={isLoading}
        >
            <TableBody>
                {fields.map((field, index) => (
                    <TableRow key={field.id} className="hover:bg-primary/5 transition-colors">
                        {/* Cuenta */}
                        <TableCell className="p-3">
                            <FormField
                                control={control}
                                name={`${name}.${index}.account`}
                                render={({ field }) => (
                                    <FormItem className="space-y-0">
                                        <FormControl>
                                            <AccountSelector value={field.value} onChange={field.onChange} className={cn(tableInputClass, "font-normal")} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </TableCell>

                        {/* Glosa */}
                        <TableCell className="p-3">
                            <FormField
                                control={control}
                                name={`${name}.${index}.label`}
                                render={({ field }) => (
                                    <FormItem className="space-y-0">
                                        <FormControl>
                                            <LabeledInput {...field} className={cn(tableInputClass, "text-center font-bold")} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </TableCell>

                        {/* Debe */}
                        <TableCell className="p-3">
                            <FormField
                                control={control}
                                name={`${name}.${index}.debit`}
                                render={({ field }) => (
                                    <FormItem className="space-y-0 text-center">
                                        <FormControl>
                                            <LabeledInput
                                                type="number"
                                                step="1"
                                                {...field}
                                                onChange={e => field.onChange(Math.ceil(e.target.valueAsNumber || 0))}
                                                onFocus={e => e.target.select()}
                                                className={cn(tableInputClass, "text-right font-mono font-bold")}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </TableCell>

                        {/* Haber */}
                        <TableCell className="p-3">
                            <FormField
                                control={control}
                                name={`${name}.${index}.credit`}
                                render={({ field }) => (
                                    <FormItem className="space-y-0 text-center">
                                        <FormControl>
                                            <LabeledInput
                                                type="number"
                                                step="1"
                                                {...field}
                                                onChange={e => field.onChange(Math.ceil(e.target.valueAsNumber || 0))}
                                                onFocus={e => e.target.select()}
                                                className={cn(tableInputClass, "text-right font-mono font-bold")}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </TableCell>

                        {/* Delete */}
                        <TableCell className="p-3 text-center">
                            <IconButton
                                onClick={() => remove(index)}
                                className="h-8 w-8 text-muted-foreground/30 hover:text-destructive"
                                title="Eliminar línea"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </IconButton>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </FormLineItemsTable>
    )
}
