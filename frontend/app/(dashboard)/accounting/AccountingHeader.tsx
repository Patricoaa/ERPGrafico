"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  ACCOUNTING_TABS,
  ACCOUNTING_CONFIG_SUB_TABS,
  getAccountingTab,
  getAccountingConfigSubTab,
} from "@/features/accounting/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

export function AccountingHeader() {
  const pathname = usePathname()
  const { getViewModeUrl } = useViewModePreference()

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "ledger"

  const activeValue = currentSegment === "settings" ? "config" : currentSegment
  const subActiveValue = currentSegment === "settings" ? (segments[2] || "vat-rates") : undefined

  // Module config from centralized registry
  const moduleConfig = getModuleHeaderConfig("accounting")

  // Build navigation from canonical config
  const tabs = ACCOUNTING_TABS.map((tab) => ({
    value: tab.value,
    label: tab.label,
    iconName: tab.iconName,
    href: tab.href,
    subTabs: tab.subTabs?.map((st) => ({
      value: st.value,
      label: st.label,
      iconName: st.iconName,
      href: st.href,
    })),
  }))

  const navigation = {
    moduleName: moduleConfig?.moduleName ?? "Contabilidad",
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("accounting.account", "/accounting/ledger"),
    tabs,
    activeValue,
    subActiveValue,
  }

  // Get header config from canonical navigation
  const getHeaderConfig = () => {
    const mainTab = getAccountingTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Contabilidad", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "calculator" as const }
    }

    // Sub-tabs handling (config)
    if (activeValue === "config" && subActiveValue) {
      const subTab = getAccountingConfigSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    // Default: main tab header
    return buildHeaderConfigFromTab(mainTab)
  }

  const config = getHeaderConfig()

  return (
    <PageHeader
      title={config.title}
      description={config.description}
      iconName={config.iconName}
      variant="minimal"
      navigation={navigation}
    />
  )
}