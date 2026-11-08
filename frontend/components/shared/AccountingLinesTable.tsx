"use client"

import { useFieldArray, useWatch, type Control, type FieldValues } from "react-hook-form"
import { Trash2 } from "lucide-react"
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import {
    FormField,
    FormItem,
    FormControl,
    FormMessage,
} from "@/components/ui/form"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { FormLineItemsTable, IconButton, LabeledInput, MoneyDisplay } from '@/components/shared'

import { cn } from "@/lib/utils"

const tableInputClass = "h-8 w-full bg-background border border-border/80 rounded-md px-2 text-xs focus:border-primary/40 focus:outline-none transition-all disabled:opacity-50"

// ─────────────────────────────────────────────────────────
// Totals footer row (tfoot)
// ─────────────────────────────────────────────────────────

const TotalsFooter = ({ control, name, disabled }: { control: Control<FieldValues>; name: string; disabled?: boolean }) => {
    const items = useWatch({ control, name }) as Array<Record<string, unknown>> | undefined

    const totalDebit = items?.reduce((sum: number, item) => sum + (Number(item.debit) || 0), 0) ?? 0
    const totalCredit = items?.reduce((sum: number, item) => sum + (Number(item.credit) || 0), 0) ?? 0
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

    return (
        <tfoot className="border-t bg-muted/30">
            <tr>
                <td className="px-3 py-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">Total</td>
                <td />
                <td className={cn("px-3 py-2 text-xs font-semibold text-right tabular-nums font-mono", isBalanced ? "text-success" : "text-destructive")}>
                    <MoneyDisplay amount={totalDebit} inline />
                </td>
                <td className={cn("px-3 py-2 text-xs font-semibold text-right tabular-nums font-mono", isBalanced ? "text-success" : "text-destructive")}>
                    <MoneyDisplay amount={totalCredit} inline />
                </td>
                {!disabled && <td />}
            </tr>
        </tfoot>
    )
}

// ─────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────

interface AccountingLinesTableProps {
    /** Control from react-hook-form */
    control: Control<FieldValues>
    /** Name of the field array in the form schema */
    name: string
    /** Loading state */
    isLoading?: boolean
    /** Disable all interactive elements */
    disabled?: boolean
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
export function AccountingLinesTable({ control, name, isLoading, disabled }: AccountingLinesTableProps) {
    const { fields, append, remove } = useFieldArray({ control, name })
    const columns = disabled ? COLUMNS.slice(0, -1) : COLUMNS

    return (
        <FormLineItemsTable
            columns={columns}
            onAdd={() => append({ account: "", label: "", debit: 0, credit: 0 })}
            addButtonText="Agregar Línea"
            isLoading={isLoading}
            hideAddButton={disabled}
        >
            <TableBody>
                {fields.map((field, index) => (
                    <TableRow key={field.id} className={cn(!disabled && "hover:bg-primary/5 transition-colors")}>
                        {/* Cuenta */}
                        <TableCell className="p-3">
                            <FormField
                                control={control}
                                name={`${name}.${index}.account`}
                                render={({ field }) => (
                                    <FormItem className="space-y-0">
                                        <FormControl>
                                            <AccountSelector value={field.value as string} onChange={field.onChange} className="w-full" disabled={disabled} />
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
                        {!disabled && (
                            <TableCell className="p-3 text-center">
                                <IconButton
                                    onClick={() => remove(index)}
                                    className="h-8 w-8 text-muted-foreground/30 hover:text-destructive"
                                    title="Eliminar línea"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </IconButton>
                            </TableCell>
                        )}
                    </TableRow>
                ))}
            </TableBody>
            <TotalsFooter control={control} name={name} disabled={disabled} />
        </FormLineItemsTable>
    )
}
