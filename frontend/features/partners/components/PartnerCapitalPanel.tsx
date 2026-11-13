"use client"

import { Layers } from "lucide-react"
import { Section } from "@/components/shared"
import type { Partner } from "@/features/contacts"
import type { PartnerActionRunner } from "./partnerActionRequest"
import { PartnerEquityPanel } from "./PartnerEquityPanel"

/** Pestaña Capital: composición del patrimonio con la acción de cada línea (los movimientos están en su propia pestaña). */
export function PartnerCapitalPanel({ partner, run }: { partner: Partner; run: PartnerActionRunner }) {
    return (
        <section aria-label="Composición del patrimonio" className="space-y-4">
            <Section.Header spaced title="Composición del patrimonio" icon={Layers} />
            <PartnerEquityPanel partner={partner} run={run} />
        </section>
    )
}
