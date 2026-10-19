"use client"

import { AlertCircle } from "lucide-react"
import { DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import type { CreditContact } from "../api/creditsApi"

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        creditContactName: { value: CreditContact; options: Record<never, never> }
    }
}

const RISK_STATUS: Record<CreditContact["credit_risk_level"], string> = {
    LOW: "RISK_LOW",
    MEDIUM: "RISK_MEDIUM",
    HIGH: "RISK_HIGH",
    CRITICAL: "RISK_CRITICAL",
}

const RISK_LABEL: Record<CreditContact["credit_risk_level"], string> = {
    LOW: "Bajo",
    MEDIUM: "Medio",
    HIGH: "Alto",
    CRITICAL: "Crítico",
}

function CreditContactNameCell({ value: contact }: ValueRenderProps<"creditContactName">) {
    return (
        <DataCell.ContactLink contactId={contact.id}>
            {contact.name}
            {contact.credit_auto_blocked && <AlertCircle className="h-3 w-3 text-warning ml-2 shrink-0" />}
        </DataCell.ContactLink>
    )
}

let registered = false
function registerCreditContactValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("creditContactName", {
        format: (c) => c.name,
        sortValue: (c) => c.name,
        shrink: true,
        render: CreditContactNameCell,
    })
}

registerCreditContactValueKinds()

export const creditContactEntity = defineEntity<CreditContact>()((f) => ({
    title: "Clientes con Crédito",
    fields: {
        name: f.value("creditContactName", (c) => c, { label: "Cliente" }),
        riskLevel: f.status(
            (c) => ({ status: RISK_STATUS[c.credit_risk_level], label: RISK_LABEL[c.credit_risk_level] }),
            { label: "Riesgo" },
        ),
        limit: f.money("credit_limit", { label: "Límite" }),
        balanceUsed: f.money("credit_balance_used", { label: "Utilizado" }),
        balanceFlow: f.flow("credit_balance_used", { label: "Deuda Actual", direction: "outflow" }),
        currentAging: f.money(
            (c) => c.credit_aging?.current ?? null,
            { label: "Vigente" },
        ),
        overdueAging: f.money(
            (c) => {
                const a = c.credit_aging
                if (!a) return null
                const sum = Number(a.overdue_30) + Number(a.overdue_60) + Number(a.overdue_90) + Number(a.overdue_90plus)
                return sum > 0 ? sum : null
            },
            { label: "En Mora" },
        ),
        status: f.status(
            (c) => {
                const hasOverdue = c.credit_aging
                    ? Number(c.credit_aging.overdue_30) + Number(c.credit_aging.overdue_60) + Number(c.credit_aging.overdue_90) + Number(c.credit_aging.overdue_90plus) > 0
                    : false
                if (c.credit_blocked) return { status: "ERROR", label: "Bloqueado" }
                if (c.credit_auto_blocked) return { status: "WARNING", label: "Auto-Bloqueo" }
                if (hasOverdue) return { status: "WARNING", label: "En mora" }
                if (Number(c.credit_balance_used) > 0) return { status: "INFO", label: "Activo" }
                return { status: "SUCCESS", label: "Al día" }
            },
            { label: "Estado" },
        ),
        lastEvaluated: f.date("credit_last_evaluated", { label: "Bloqueado desde", time: true }),
    },
}))

export const portfolioViews = creditContactEntity.views({
    table: {
        columns: ["name", "riskLevel", "limit", "balanceUsed", "currentAging", "overdueAging", "status"],
        primary: "name",
    },
})

export const blacklistContactViews = creditContactEntity.views({
    table: {
        columns: ["name", "balanceFlow", "lastEvaluated"],
        primary: "name",
    },
})
