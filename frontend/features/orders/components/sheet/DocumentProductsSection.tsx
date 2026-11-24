"use client"

import { Package } from "lucide-react"
import { Section } from "@/components/shared"
import type { OrderLine } from "../../types"
import { DocumentLinesTable } from "./DocumentLinesTable"
import { DocumentTotalsBox } from "./DocumentTotalsBox"
import type { ComponentProps } from "react"

interface DocumentProductsSectionProps {
    lines: OrderLine[]
    kind: ComponentProps<typeof DocumentLinesTable>["kind"]
    onCreateWorkOrder?: (line: OrderLine) => void
    totals: Omit<ComponentProps<typeof DocumentTotalsBox>, "className">
}

/**
 * Productos + recuadro de totales de la ficha documental. La tabla ocupa toda la altura que deja el resto de
 * la ficha y el recuadro queda al pie; con muchas líneas la tabla crece y empuja el recuadro hacia abajo
 * (la pestaña hace el scroll).
 */
export function DocumentProductsSection({ lines, kind, onCreateWorkOrder, totals }: DocumentProductsSectionProps) {
    return (
        <section className="flex flex-1 flex-col gap-4">
            <Section.Header spaced title="Productos" icon={Package} />
            <div className="flex flex-1 flex-col">
                <DocumentLinesTable lines={lines} kind={kind} onCreateWorkOrder={onCreateWorkOrder} />
            </div>
            <DocumentTotalsBox {...totals} className="mt-auto" />
        </section>
    )
}
