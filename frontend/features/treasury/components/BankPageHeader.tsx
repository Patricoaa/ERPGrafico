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
        />
    )
}
