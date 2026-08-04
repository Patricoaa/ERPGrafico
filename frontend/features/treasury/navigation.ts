import { getEntityIconName } from "@/lib/entity-registry"

export const OPERACIONES_SUB_TABS = [
    { value: "movements", label: "Movimientos", href: "/treasury/operaciones/movements", iconName: getEntityIconName('treasury.treasurymovement') },
    { value: "accounts", label: "Cuentas de Tesorería", href: "/treasury/operaciones/accounts", iconName: getEntityIconName('treasury.treasuryaccount') },
    { value: "methods", label: "Métodos de Pago", href: "/treasury/operaciones/methods", iconName: getEntityIconName('treasury.paymentmethod') },
    { value: "checks", label: "Cheques Recibidos", href: "/treasury/operaciones/checks", iconName: getEntityIconName('treasury.check') },
]

export const TERMINAL_COBRO_SUB_TABS = [
    { value: "providers", label: "Proveedores", href: "/treasury/terminal-cobro/providers", iconName: getEntityIconName('treasury.terminalprovider') },
    { value: "devices", label: "Dispositivos", href: "/treasury/terminal-cobro/devices", iconName: getEntityIconName('treasury.terminaldevice') },
    { value: "batches", label: "Lotes de Pago", href: "/treasury/terminal-cobro/batches", iconName: getEntityIconName('treasury.terminalbatch') },
]

export const BANK_SUB_VIEWS = [
    { value: "overview", label: "Resumen", iconName: "bar-chart-3" },
    { value: "movements", label: "Movimientos", iconName: "arrow-right-left" },
    { value: "checks", label: "Cheques", iconName: "check-square" },
    { value: "loans", label: "Préstamos", iconName: "landmark" },
    { value: "cards", label: "Tarjeta", iconName: "credit-card" },
    { value: "reconciliation", label: "Conciliación", iconName: "git-compare" },
]

export function buildBankSubTabs(banks: { id: number; is_active: boolean; name: string }[]) {
    const allTab = { value: 'all', label: 'Todos', iconName: 'layout-grid' as string, href: '/treasury/bank-center' }
    const bankTabs = banks
        .filter(b => b.is_active)
        .map(bank => ({
            value: `bank-${bank.id}`,
            label: bank.name,
            iconName: 'landmark' as string,
            href: `/treasury/bank-center/${bank.id}/overview`,
            subTabs: BANK_SUB_VIEWS.map(sv => ({
                value: sv.value,
                label: sv.label,
                iconName: sv.iconName,
                href: `/treasury/bank-center/${bank.id}/${sv.value === 'cards' ? 'cards/unbilled' : sv.value}`,
            })),
        }))
    return [allTab, ...bankTabs]
}
