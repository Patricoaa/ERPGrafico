"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  PURCHASING_TABS,
  getPurchasingTab,
} from "@/features/purchasing/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

export function PurchasingHeader() {
  const pathname = usePathname()
  const { getViewModeUrl } = useViewModePreference()

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "orders"

  const activeValue = currentSegment

  // Module config from centralized registry
  const moduleConfig = getModuleHeaderConfig("purchasing")

  // Build navigation from canonical config
  const tabs = PURCHASING_TABS.map((tab) => ({
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
    moduleName: moduleConfig?.moduleName ?? "Compras",
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("purchasing.purchaseorder", "/purchasing/orders"),
    tabs,
    activeValue,
    subActiveValue: undefined,
  }

  // Get header config from canonical navigation
  const getHeaderConfig = () => {
    const mainTab = getPurchasingTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Compras", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "shopping-bag" as const }
    }

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