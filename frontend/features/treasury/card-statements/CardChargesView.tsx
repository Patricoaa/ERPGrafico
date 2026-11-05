"use client"

import { usePathname, useRouter } from "next/navigation"
import { TabBar } from "@/components/shared"
import { UnbilledChargesClientView } from './UnbilledChargesClientView'
import { CardStatementsClientView } from './CardStatementsClientView'

const CARD_SUB_TABS = [
    { value: "unbilled", label: "Cargos No Facturados" },
    { value: "statements", label: "Cargos Facturados" },
] as const

type CardSubTab = (typeof CARD_SUB_TABS)[number]["value"]

interface CardChargesViewProps {
    /** Sin banco: vista agregada de tarjetas, con su barra de subpestañas. Con banco: el dashboard del banco ya muestra las subpestañas. */
    bankId?: number
    subtab?: string
}

/**
 * Cargos de tarjeta: una sola vista para el banco y para todos los bancos. La subpestaña viene de
 * `subtab` (dashboard del banco) o de la ruta `/cards/<subpestaña>` (vista agregada).
 */
export function CardChargesView({ bankId, subtab }: CardChargesViewProps) {
    const pathname = usePathname()
    const router = useRouter()
    const fromPath: CardSubTab = pathname.endsWith("/cards/statements") ? "statements" : "unbilled"
    const activeSubTab: CardSubTab = bankId
        ? (subtab === "statements" ? "statements" : "unbilled")
        : (subtab === "statements" || subtab === "unbilled" ? subtab : fromPath)

    return (
        <div className="h-full flex flex-col">
            {!bankId && (
                <div className="flex justify-start pt-2">
                    <TabBar
                        items={CARD_SUB_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
                        value={activeSubTab}
                        onValueChange={(value) => router.push(`/treasury/bank-center/cards/${value}`)}
                        variant="underline"
                        dense
                        className="w-full"
                        containerClassName="justify-start"
                    >
                        <div className="hidden" />
                    </TabBar>
                </div>
            )}
            <div className="flex-1 min-h-0 flex flex-col">
                {activeSubTab === 'unbilled' && <UnbilledChargesClientView bankId={bankId} />}
                {activeSubTab === 'statements' && <CardStatementsClientView bankId={bankId} />}
            </div>
        </div>
    )
}
