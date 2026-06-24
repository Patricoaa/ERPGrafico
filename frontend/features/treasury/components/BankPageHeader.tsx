"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { useBanks } from "@/features/treasury"
import type { PageHeaderStatus } from "@/components/shared"

interface BankPageHeaderProps {
    bankId: number
    breadcrumbs?: { label: string; href?: string }[]
    title?: string
    description?: string
    status?: PageHeaderStatus
    titleActions?: React.ReactNode
}

const SUB_VIEWS = [
    { value: "overview", label: "Resumen", iconName: "layout-dashboard" },
    { value: "movements", label: "Movimientos Bancarios", iconName: "receipt" },
    { value: "checks", label: "Cheques Girados", iconName: "file-check" },
    { value: "loans", label: "Préstamos", iconName: "banknote" },
    { value: "cards", label: "Tarjeta de crédito", iconName: "credit-card" },
    { value: "reconciliation", label: "Conciliación", iconName: "arrow-left-right" },
]

export function BankPageHeader({ bankId, breadcrumbs, title = "", description, status, titleActions }: BankPageHeaderProps) {
    const { banks } = useBanks()
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const subSubActiveValue = segments[3] || 'overview'

    const bankSubTabs = [
        { value: "all", label: "Todos", iconName: "layout-grid", href: "/treasury/bank-center" },
        ...banks
            .filter(b => b.is_active)
            .map(bank => ({
                value: `bank-${bank.id}`,
                label: bank.name,
                iconName: "landmark" as string,
                href: `/treasury/bank-center/${bank.id}/${subSubActiveValue}`,
            })),
    ]

    const sectionTabs = SUB_VIEWS.map(sv => ({
        value: sv.value,
        label: sv.label,
        href: sv.value === 'cards'
            ? `/treasury/bank-center/${bankId}/cards/unbilled`
            : `/treasury/bank-center/${bankId}/${sv.value}`,
    }))

    const navigation = {
        moduleName: "Tesorería",
        moduleHref: "/treasury",
        tabs: [
            { value: "operaciones", label: "Operaciones", iconName: "banknote", href: "/treasury/operaciones/movements" },
            { value: "bank-center", label: "Centro de Bancos", iconName: "landmark", href: "/treasury/bank-center", subTabs: bankSubTabs },
            { value: "terminal-cobro", label: "Terminal de Cobro", iconName: "cpu", href: "/treasury/terminal-cobro/providers" },

        ],
        activeValue: "bank-center",
        subActiveValue: `bank-${bankId}`,
        subSubActiveValue,
        breadcrumbs,
    }

    return (
        <PageHeader
            title={title}
            description={description}
            status={status}
            titleActions={titleActions}
            variant="minimal"
            navigation={navigation}
            sectionTabs={sectionTabs}
        />
    )
}
