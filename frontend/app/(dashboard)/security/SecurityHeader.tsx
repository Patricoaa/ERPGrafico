"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import {
  SECURITY_TABS,
  getSecurityTab,
  getSecurityUsersSubTab,
} from "@/features/security"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"
import { useDebugToolsAccess } from "@/features/settings"

export function SecurityHeader() {
  const pathname = usePathname()
  const canDebug = useDebugToolsAccess()

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "users"

  const activeValue = currentSegment
  const subActiveValue = activeValue === "users" ? (segments[2] || "users") : undefined

  const moduleConfig = getModuleHeaderConfig("security")

  // Filter debug tab if user does not have debug access
  const visibleTabs = canDebug ? SECURITY_TABS : SECURITY_TABS.filter((t) => t.value !== "debug")

  const tabs = visibleTabs.map((tab) => ({
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
    moduleName: moduleConfig?.moduleName ?? "Seguridad",
    moduleHref: moduleConfig?.moduleHref ?? "/security/users",
    tabs,
    activeValue,
    subActiveValue,
  }

  const getHeaderConfig = () => {
    const mainTab = getSecurityTab(activeValue)
    if (!mainTab) {
      return {
        title: moduleConfig?.headerTitle ?? "Seguridad y Control",
        description: moduleConfig?.headerDescription ?? "",
        iconName: moduleConfig?.iconName ?? "shield-check",
      }
    }

    if (activeValue === "users" && subActiveValue) {
      const subTab = getSecurityUsersSubTab(subActiveValue)
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
