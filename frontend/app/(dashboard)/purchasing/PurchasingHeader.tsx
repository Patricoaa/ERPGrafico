"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  PURCHASING_TABS,
  getPurchasingTab,
  getPurchasingDtesSubTab,
  getPurchasingConfigSubTab,
} from "@/features/purchasing/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

export function PurchasingHeader() {
  const pathname = usePathname()
  const { getViewModeUrl } = useViewModePreference()

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "docs"

  // ADR-0090: `dtes` y `docs` corresponden al tab Documentos (sub-segmentos orders/fulfillment),
  // `settings` es el tab Configuración de Compras.
  const segmentToTab: Record<string, string> = {
    docs: "dtes",
    dtes: "dtes",
    settings: "config",
  }

  const activeValue = segmentToTab[currentSegment] || "dtes"

  // Determine subActiveValue from path segments
  const subActiveValue = (() => {
    if (activeValue === "dtes") {
      if (currentSegment === "docs") return "orders"
      return segments[2] || "dtes"
    }
    if (activeValue === "config") return segments[2] || "dtes"
    return undefined
  })()

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
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("purchasing.purchaseorder", "/purchasing/docs"),
    tabs,
    activeValue,
    subActiveValue,
  }

  // Get header config from canonical navigation
  const getHeaderConfig = () => {
    const mainTab = getPurchasingTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Compras", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "shopping-bag" as const }
    }

    // Sub-tabs handling (tab Documentos)
    if (activeValue === "dtes" && subActiveValue) {
      const subTab = getPurchasingDtesSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    // Sub-tabs handling (tab Configuración de Compras)
    if (activeValue === "config" && subActiveValue) {
      const subTab = getPurchasingConfigSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
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