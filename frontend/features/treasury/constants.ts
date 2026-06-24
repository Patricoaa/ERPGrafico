export interface SubViewTab {
    value: string
    label: string
    href: string
}

export const SUB_VIEWS_BASE = [
    { value: "overview", label: "Resumen" },
    { value: "movements", label: "Movimientos" },
    { value: "checks", label: "Cheques" },
    { value: "loans", label: "Préstamos" },
    { value: "cards", label: "Tarjeta" },
    { value: "reconciliation", label: "Conciliación" },
] as const

export function getSubViewTabs(bankId: number): SubViewTab[] {
    return SUB_VIEWS_BASE.map(sv => ({
        value: sv.value,
        label: sv.label,
        href: `/treasury/bank-center/${bankId}/${sv.value === "cards" ? "cards/unbilled" : sv.value}`,
    }))
}
