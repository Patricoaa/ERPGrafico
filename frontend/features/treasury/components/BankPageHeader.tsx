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
    subtab?: string
}

const SUB_VIEWS = [
    { value: "overview", label: "Resumen", iconName: "layout-dashboard" },
    { value: "checks", label: "Cheques Girados", iconName: "file-check" },
    { value: "loans", label: "Préstamos", iconName: "banknote" },
    { value: "cards", label: "Tarjeta de crédito", iconName: "credit-card" },
    { value: "reconciliation", label: "Conciliación", iconName: "arrow-left-right" },
]

export function BankPageHeader({ bankId, breadcrumbs, title = "", description, status, titleActions, subtab }: BankPageHeaderProps) {
    const { banks } = useBanks()
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const subSubActiveValue = segments[3] || 'overview'

    const bankSubTabs = [
        { value: "all", label: "Todos", iconName: "layout-grid", href: "/treasury/centro-bancos" },
        ...banks
            .filter(b => b.is_active)
            .map(bank => ({
                value: `bank-${bank.id}`,
                label: bank.name,
                iconName: "landmark" as string,
                href: `/treasury/centro-bancos/${bank.id}`,
                                subTabs: SUB_VIEWS.map(sv => {
                                    const baseHref = sv.value === 'cards'
                                        ? `/treasury/centro-bancos/${bank.id}/cards`
                                        : `/treasury/centro-bancos/${bank.id}/${sv.value}`
                                    return {
                                        value: sv.value,
                                        label: sv.label,
                                        iconName: sv.iconName,
                                        href: sv.value === 'cards'
                                            ? `${baseHref}/${subtab || 'unbilled'}`
                                            : baseHref,
                                        ...(sv.value === 'cards' && {
                                            subTabs: [
                                                { value: "unbilled", label: "Cargos No Facturados", iconName: "file-text", href: `${baseHref}/unbilled` },
                                                { value: "statements", label: "Cargos Facturados", iconName: "file-text", href: `${baseHref}/statements` },
                                            ],
                                        }),
                                    }
                                }),
            })),
    ]

    const navigation = {
        moduleName: "Tesorería",
        moduleHref: "/treasury",
        tabs: [
            { value: "operaciones", label: "Operaciones", iconName: "banknote", href: "/treasury/operaciones/movements" },
            { value: "centro-bancos", label: "Centro de Bancos", iconName: "landmark", href: "/treasury/centro-bancos", subTabs: bankSubTabs },
            { value: "terminal-cobro", label: "Terminal de Cobro", iconName: "cpu", href: "/treasury/terminal-cobro/providers" },

        ],
        activeValue: "centro-bancos",
        subActiveValue: `bank-${bankId}`,
        subSubActiveValue,
        subSubSubActiveValue: subtab || 'unbilled',
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
        />
    )
}
