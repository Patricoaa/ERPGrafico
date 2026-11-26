"use client"

import * as React from "react"
import { Controller, useFormContext } from "react-hook-form"
import { AlertCircle } from "lucide-react"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { LabeledSelect } from "@/components/shared"
import { cn } from "@/lib/utils"
import type { Account } from "@/features/accounting"

/**
 * Account → report category mapping (MappingConfigModal). The category cell edits the modal's form
 * (`useFormContext`, one field per account id); its options come from `MappingCategoriesProvider`.
 */
export interface MappingCategoryValue {
    accountId: number
    /** Saved category, `"none"` when unmapped. */
    original: string
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        accountMappingCategory: { value: MappingCategoryValue; options: Record<never, never> }
    }
}

export interface MappingCategoryOption {
    value: string
    label: string
}

const MappingCategoriesContext = React.createContext<readonly MappingCategoryOption[]>([])

export function MappingCategoriesProvider({ options, children }: { options: readonly MappingCategoryOption[]; children: React.ReactNode }) {
    return <MappingCategoriesContext.Provider value={options}>{children}</MappingCategoriesContext.Provider>
}

function MappingCategoryCell({ value }: ValueRenderProps<"accountMappingCategory">) {
    const { control } = useFormContext<Record<string, string | null>>()
    const categories = React.useContext(MappingCategoriesContext)
    return (
        <Controller
            control={control}
            name={String(value.accountId)}
            render={({ field }) => {
                const current = field.value ?? "none"
                const unmapped = current === "none"
                const modified = current !== value.original
                return (
                    // The select is the cell's control: clicks must not open the row.
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {unmapped && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-warning-text" aria-hidden />}
                        <LabeledSelect
                            variant="inline"
                            value={current}
                            onChange={field.onChange}
                            className={cn(
                                "h-8 w-[200px] text-2xs font-medium",
                                modified && "border-primary/50 bg-primary/5 ring-1 ring-primary/50",
                                unmapped && !modified && "border-warning/30 bg-warning/5 text-warning-text",
                            )}
                            options={[
                                { value: "none", label: <span className="italic text-muted-foreground">Sin mapeo</span> },
                                ...categories.map((c) => ({ value: c.value, label: c.label })),
                            ]}
                        />
                    </div>
                )
            }}
        />
    )
}

let registered = false
function registerAccountMappingKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("accountMappingCategory", {
        format: (v) => v.original,
        sortValue: (v) => v.original,
        render: MappingCategoryCell,
    })
}
registerAccountMappingKinds()

/** Account row of the mapping modal: `original` is the saved value of the mapped field. */
export interface AccountMappingRow extends Account {
    original: string
}

export const accountMappingEntity = defineEntity<AccountMappingRow>()((f) => ({
    title: "Cuentas",
    rowId: (a) => a.id,
    fields: {
        code: f.code("code", { label: "Código" }),
        name: f.text("name", { label: "Cuenta" }),
        type: f.text("account_type_display", { label: "Tipo", tone: "secondary" }),
        category: f.value("accountMappingCategory", (a) => ({ accountId: a.id, original: a.original }), { label: "Categoría asignada", sortable: false }),
    },
    // Every account is loaded: search and sorting run in the browser.
    query: {
        search: { placeholder: "Buscar por código o nombre…" },
        sort: { fields: ["code", "name"], default: "code" },
    },
}))

export const accountMappingViews = accountMappingEntity.views({
    table: { columns: ["code", "name", "type", "category"], primary: "name" },
})
