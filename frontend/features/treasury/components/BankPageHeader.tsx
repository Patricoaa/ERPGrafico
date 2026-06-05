"use client"

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

export function BankPageHeader({ bankId, breadcrumbs, title = "", description, status, titleActions }: BankPageHeaderProps) {
    const { banks } = useBanks()

    const bankSubTabs = [
        { value: "all", label: "Todos", iconName: "layout-grid", href: "/treasury/centro-bancos" },
        ...banks
            .filter(b => b.is_active)
            .map(bank => ({
                value: `bank-${bank.id}`,
                label: bank.name,
                iconName: "landmark" as string,
                href: `/treasury/centro-bancos/${bank.id}`,
            })),
    ]

    const navigation = {
        moduleName: "Tesorería",
        moduleHref: "/treasury",
        tabs: [
            { value: "operaciones", label: "Operaciones", iconName: "banknote", href: "/treasury/operaciones?tab=movements" },
            { value: "centro-bancos", label: "Centro de Bancos", iconName: "landmark", href: "/treasury/centro-bancos", subTabs: bankSubTabs },
            { value: "terminal-cobro", label: "Terminal de Cobro", iconName: "cpu", href: "/treasury/terminal-cobro?tab=providers" },
            { value: "config", label: "Configuración", iconName: "settings", href: "/treasury/settings?tab=conciliation" },
        ],
        activeValue: "centro-bancos",
        subActiveValue: `bank-${bankId}`,
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
