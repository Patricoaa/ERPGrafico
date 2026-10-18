"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  BILLING_TABS,
  BILLING_CONFIG_SUB_TABS,
  getBillingTab,
  getBillingConfigSubTab,
} from "@/features/billing/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

export function BillingHeader() {
  const pathname = usePathname()
  const { getViewModeUrl } = useViewModePreference()

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "sales"

  const activeValue = currentSegment === "settings" ? "config" : currentSegment
  const subActiveValue = currentSegment === "settings" ? (segments[2] || "dtes") : undefined

  // Module config from centralized registry
  const moduleConfig = getModuleHeaderConfig("billing")

  // Build navigation from canonical config
  const tabs = BILLING_TABS.map((tab) => ({
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
    moduleName: moduleConfig?.moduleName ?? "Facturación",
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("billing.invoice", "/billing/sales"),
    tabs,
    activeValue,
    subActiveValue,
  }

  // Get header config from canonical navigation
  const getHeaderConfig = () => {
    const mainTab = getBillingTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Facturación", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "file-text" as const }
    }

    // Sub-tabs handling (config)
    if (activeValue === "config" && subActiveValue) {
      const subTab = getBillingConfigSubTab(subActiveValue)
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