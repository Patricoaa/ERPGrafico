"use client"

import { Chip } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import type { PayrollConcept } from "@/types/hr"

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        payrollConceptName: { value: PayrollConcept; options: Record<never, never> }
        payrollConceptCategory: { value: PayrollConcept; options: Record<never, never> }
    }
}

function PayrollConceptNameCell({ value: concept }: ValueRenderProps<"payrollConceptName">) {
    return (
        <div className="flex items-center gap-2 py-1">
            <span className="font-black text-xs tracking-tight uppercase leading-none">{concept.name}</span>
            {concept.is_system && (
                <Chip size="xs" intent="primary">SYSTEM</Chip>
            )}
        </div>
    )
}

function PayrollConceptCategoryCell({ value: concept }: ValueRenderProps<"payrollConceptCategory">) {
    const isHaber = concept.category.includes('HABER')
    return <Chip size="xs" intent={isHaber ? "success" : "destructive"}>{concept.category_display}</Chip>
}

let registered = false
function registerPayrollConceptValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("payrollConceptName", {
        format: (c) => c.name,
        sortValue: (c) => c.name,
        render: PayrollConceptNameCell,
    })
    registerValueKind("payrollConceptCategory", {
        format: (c) => c.category_display,
        sortValue: (c) => c.category_display,
        render: PayrollConceptCategoryCell,
    })
}

registerPayrollConceptValueKinds()

export const payrollConceptEntity = defineEntity<PayrollConcept>()((f) => ({
    title: "Concepto de Nómina",
    rowId: (c) => c.id,
    fields: {
        name: f.value("payrollConceptName", (c) => c, { label: "Concepto de Nómina" }),
        category: f.value("payrollConceptCategory", (c) => c, { label: "Categoría" }),
        formulaType: f.text("formula_type_display", { label: "Lógica / Fórmula" }),
        accountCode: f.text("account_code", { label: "Cuenta Contable" }),
    },
}))

export const payrollConceptViews = payrollConceptEntity.views({
    table: {
        columns: ["name", "category", "formulaType", "accountCode"],
        primary: "name",
    },
})
