"use client"

import { PageHeader } from "@/components/shared"
import { useBanks } from "@/features/treasury"
import type { PageHeaderStatus } from "@/components/shared"
import {
  TREASURY_TABS,
  OPERACIONES_SUB_TABS,
  TERMINAL_COBRO_SUB_TABS,
  buildBankSubTabs,
  getBankSubView,
} from "@/features/treasury/navigation"
import { buildHeaderConfigFromTab, overrideHeaderConfig } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

interface BankPageHeaderProps {
  bankId: number
  breadcrumbs?: { label: string; href?: string }[]
  /** Override del título (ej. nombre del banco + sub-vista) */
  title?: string
  /** Override de la descripción */
  description?: string
  status?: PageHeaderStatus
  titleActions?: React.ReactNode
  /** Sub-vista activa (overview, movements, checks, loans, cards, reconciliation) */
  subView?: string
}

export function BankPageHeader({
  bankId,
  breadcrumbs,
  title,
  description,
  status,
  titleActions,
  subView = "overview",
}: BankPageHeaderProps) {
  const { banks } = useBanks()

  const bankSubTabs = buildBankSubTabs(banks)
  const bankValue = `bank-${bankId}`

  // Module config from centralized registry
  const moduleConfig = getModuleHeaderConfig("treasury")

  // Build navigation from canonical config (TREASURY_TABS)
  const tabs = TREASURY_TABS.map((tab) => ({
    value: tab.value,
    label: tab.label,
    iconName: tab.iconName,
    href: tab.href,
    subTabs: tab.value === "bank-center"
      ? bankSubTabs.map((st) => ({ value: st.value, label: st.label, iconName: st.iconName, href: st.href }))
      : tab.subTabs?.map((st) => ({ value: st.value, label: st.label, iconName: st.iconName, href: st.href })),
  }))

  const navigation = {
    moduleName: moduleConfig?.moduleName ?? "Tesorería",
    moduleHref: moduleConfig?.moduleHref ?? "/treasury",
    tabs,
    activeValue: "bank-center",
    subActiveValue: bankValue,
    breadcrumbs,
  }

  // Get header config from canonical navigation
  const bankTab = bankSubTabs.find((t) => t.value === bankValue)
  const subTab = bankTab?.subTabs?.find((st) => st.value === subView)

  let config: { title: string; description: string; iconName: string } = { title: "Banco", description: "", iconName: "landmark" }

  if (subTab) {
    config = buildHeaderConfigFromTab(subTab)
    // Si el título base es genérico, usar nombre del banco
    const selectedBank = banks.find((b) => b.id === bankId)
    if (selectedBank && config.title === subTab.headerTitle) {
      config = overrideHeaderConfig(config, { title: selectedBank.name })
    }
  } else if (bankTab) {
    config = buildHeaderConfigFromTab(bankTab)
    const selectedBank = banks.find((b) => b.id === bankId)
    if (selectedBank) {
      config = overrideHeaderConfig(config, { title: selectedBank.name })
    }
  }

  // Allow prop overrides (for dynamic titles like "Banco X - Movimientos")
  if (title) config = overrideHeaderConfig(config, { title })
  if (description) config = overrideHeaderConfig(config, { description })

  return (
    <PageHeader
      title={config.title}
      description={config.description}
      iconName={config.iconName}
      status={status}
      titleActions={titleActions}
      variant="minimal"
      navigation={navigation}
    />
  )
}