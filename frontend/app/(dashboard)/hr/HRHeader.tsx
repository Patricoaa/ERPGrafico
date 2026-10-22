"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  HR_TABS,
  HR_CONFIG_SUB_TABS,
  getHRTab,
  getHRConfigSubTab,
} from "@/features/hr/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

export function HRHeader() {
  const pathname = usePathname()
  const { getViewModeUrl } = useViewModePreference()

  // Determine active view from pathname
  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "employees"

  const activeValue = currentSegment === "settings" ? "config" : currentSegment
  const subActiveValue = currentSegment === "settings" ? (segments[2] || "global") : undefined

  // Module config from centralized registry
  const moduleConfig = getModuleHeaderConfig("hr")

  // Build navigation from canonical config
  const tabs = HR_TABS.map((tab) => ({
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
    moduleName: moduleConfig?.moduleName ?? "Recursos Humanos",
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("hr.employee", "/hr/employees"),
    tabs,
    activeValue,
    subActiveValue,
  }

  // Get header config from canonical navigation
  const getHeaderConfig = () => {
    const mainTab = getHRTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Recursos Humanos", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "users" as const }
    }

    // Sub-tabs handling (config)
    if (activeValue === "config" && subActiveValue) {
      const subTab = getHRConfigSubTab(subActiveValue)
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