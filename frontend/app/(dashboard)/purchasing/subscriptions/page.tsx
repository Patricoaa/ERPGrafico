import type { Metadata } from "next"
import { SubscriptionsClientView } from "@/features/purchasing"
import { ToolbarCreateButton } from "@/components/shared"
import { getPurchasingTab } from "@/features/purchasing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getPurchasingTab("subscriptions")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Suscripciones | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function PurchasingSubscriptionsPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const createAction = <ToolbarCreateButton label="Nueva Suscripción" href="/purchasing/subscriptions?modal=new" />

  return (
    <>
      <SubscriptionsClientView
        hideHeader
        externalOpen={modal === "new"}
        createAction={createAction}
      />
    </>
  )
}