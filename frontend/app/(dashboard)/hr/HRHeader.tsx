"use client"

import { useState, useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  HR_TABS,
  getHRTab,
  getHRPayrollsSubTab,
} from "@/features/hr/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

const HRSettingsModal = dynamic(
  () => import("@/features/hr").then(m => ({ default: m.HRSettingsModal })),
  { ssr: false },
)

export function HRHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { getViewModeUrl } = useViewModePreference()
  const [isSettingsOpen, setIsSettingsOpen] = useState(searchParams.get("modal") === "settings")
  const settingsAction = useMemo(() => ({ label: "Configuración de RRHH", open: () => setIsSettingsOpen(true) }), [])
  const initialSection = searchParams.get("tab") || undefined

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "employees"

  const activeValue = currentSegment
  const subActiveValue = (() => {
    if (activeValue === "payrolls") return segments[2] || "payrolls"
    return undefined
  })()

  const moduleConfig = getModuleHeaderConfig("hr")

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

  const getHeaderConfig = () => {
    const mainTab = getHRTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Recursos Humanos", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "users" as const }
    }

    if (activeValue === "payrolls" && subActiveValue) {
      const subTab = getHRPayrollsSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    return buildHeaderConfigFromTab(mainTab)
  }

  const config = getHeaderConfig()

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        iconName={config.iconName}
        variant="minimal"
        navigation={navigation}
        settings={settingsAction}
      />
      {isSettingsOpen && (
        <HRSettingsModal onOpenChange={setIsSettingsOpen} initialSection={initialSection} />
      )}
    </>
  )
}
