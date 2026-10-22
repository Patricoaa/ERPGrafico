"use client"

import { usePathname, useRouter } from "next/navigation"
import { TabBar } from "@/components/shared"
import { UnbilledChargesClientView } from "./UnbilledChargesClientView"
import { StatementsClientView } from "./StatementsClientView"

const CARD_SUB_TABS = [
    { value: "unbilled", label: "Cargos No Facturados", href: "/treasury/bank-center/cards/unbilled" },
    { value: "statements", label: "Cargos Facturados", href: "/treasury/bank-center/cards/statements" },
]

/**
 * Vista agregada de tarjetas de crédito (Centro de Bancos → Tarjeta).
 * Mantiene las sub-tabs tarjeta (No Facturados / Facturados) dentro de la
 * página, igual que la vista por banco.
 */
export function CardChargesAggregateView() {
    const pathname = usePathname()
    const router = useRouter()
    const activeSubTab = pathname.endsWith("/cards/statements") ? "statements" : "unbilled"

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-start pt-2">
                <TabBar
                    items={CARD_SUB_TABS.map(t => ({ value: t.value, label: t.label }))}
                    value={activeSubTab}
                    onValueChange={(value) => {
                        const tab = CARD_SUB_TABS.find(t => t.value === value)
                        if (tab) router.push(tab.href)
                    }}
                    variant="underline"
                    dense
                    className="w-full"
                    containerClassName="justify-start"
                >
                    <div className="hidden" />
                </TabBar>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
                {activeSubTab === "unbilled" && <UnbilledChargesClientView />}
                {activeSubTab === "statements" && <StatementsClientView />}
            </div>
        </div>
    )
}
