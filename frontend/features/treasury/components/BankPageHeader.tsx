"use client"

import { PageHeader } from "@/components/shared"
import { useBanks } from "@/features/treasury"
import type { PageHeaderStatus } from "@/components/shared"
import { OPERACIONES_SUB_TABS, TERMINAL_COBRO_SUB_TABS, buildBankSubTabs } from "@/features/treasury/navigation"

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

    const bankSubTabs = buildBankSubTabs(banks)

    const navigation = {
        moduleName: "Tesorería",
        moduleHref: "/treasury",
        tabs: [
            { value: "operaciones", label: "Operaciones", iconName: "banknote", href: "/treasury/operaciones/movements", subTabs: OPERACIONES_SUB_TABS },
            { value: "bank-center", label: "Centro de Bancos", iconName: "landmark", href: "/treasury/bank-center", subTabs: bankSubTabs },
            { value: "terminal-cobro", label: "Terminal de Cobro", iconName: "cpu", href: "/treasury/terminal-cobro/providers", subTabs: TERMINAL_COBRO_SUB_TABS },
        ],
        activeValue: "bank-center",
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
