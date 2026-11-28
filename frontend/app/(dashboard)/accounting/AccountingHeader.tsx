"use client"

import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  ACCOUNTING_TABS,
  getAccountingTab,
  getRcvSubTab,
  resolveAccountingNav,
} from "@/features/accounting/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

const AccountingSettingsModal = dynamic(
  () => import("@/features/accounting").then(m => ({ default: m.AccountingSettingsModal })),
  { ssr: false },
)

export function AccountingHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { getViewModeUrl } = useViewModePreference()
  const [isSettingsOpen, setIsSettingsOpen] = useState(searchParams.get("modal") === "settings")
  const initialSection = searchParams.get("tab") || undefined

  const { activeValue, subActiveValue } = resolveAccountingNav(pathname)

  const moduleConfig = getModuleHeaderConfig("accounting")

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

  const getHeaderConfig = () => {
    const mainTab = getAccountingTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Contabilidad", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "calculator" as const }
    }

    if (activeValue === "rcv" && subActiveValue) {
      const subTab = getRcvSubTab(subActiveValue)
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
        titleActions={
          <Button variant="ghost" size="icon" className="size-control-xs" onClick={() => setIsSettingsOpen(true)} title="Configuración de Contabilidad">
            <Settings className="h-4 w-4" />
          </Button>
        }
      />
      {isSettingsOpen && (
        <AccountingSettingsModal onOpenChange={setIsSettingsOpen} initialSection={initialSection} />
      )}
    </>
  )
}
