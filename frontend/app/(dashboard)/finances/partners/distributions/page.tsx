import type { Metadata } from "next"
import { PageHeader, ToolbarCreateButton } from "@/components/shared"
import { PartnersSettingsView } from "@/features/settings"
import {
  FINANCES_TABS,
  getFinancesTab,
  getFinancesPartnersSubTab,
} from "@/features/finances/navigation"
import { buildMetadataFromTab, buildHeaderConfigFromTab } from "@/lib/navigation-helpers"

const tabConfig = getFinancesPartnersSubTab("distributions")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Distribución de Utilidades | ERPGrafico" }

const mainTab = getFinancesTab("partners")
const headerConfig = mainTab ? buildHeaderConfigFromTab(mainTab) : { title: "Capital y Socios", description: "", iconName: "users" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function PartnersDistributionsPage({ searchParams }: PageProps) {
  const { modal } = await searchParams

  const navigation = {
    moduleName: "Finanzas",
    moduleHref: "/finances",
    tabs: FINANCES_TABS.map((tab) => ({
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
    })),
    activeValue: "partners",
    subActiveValue: "distributions",
  }

  const createAction = (
    <ToolbarCreateButton
      label="Nueva Distribución"
      href="/finances/partners/distributions?modal=new-distribution"
    />
  )

  return (
    <>
      <PageHeader
        title={headerConfig.title}
        description={headerConfig.description}
        iconName={headerConfig.iconName}
        variant="minimal"
        navigation={navigation}
      />

      <PartnersSettingsView
        activeTab="distributions"
        initialFlowOpen={modal === "new-distribution"}
        createAction={createAction}
      />
    </>
  )
}