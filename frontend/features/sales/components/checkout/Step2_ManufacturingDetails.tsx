"use client"

import { useState, useMemo } from "react"
import { AdvancedManufacturingDrawer } from "../forms/AdvancedManufacturingDrawer"
import { EmptyState } from "@/components/shared"
import { type SaleOrderLine } from "../../types"
import { getMfgLineSubType, type ManufacturableLine } from "../../utils/mfgLine"
import { MfgLineCard } from "./MfgLineCard"

interface Step2_ManufacturingDetailsProps {
    orderLines: SaleOrderLine[]
    setOrderLines: (lines: SaleOrderLine[]) => void
}

export function Step2_ManufacturingDetails({ orderLines, setOrderLines }: Step2_ManufacturingDetailsProps) {
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

    const advancedLines: ManufacturableLine[] = useMemo(() =>
        orderLines
            .map((line, index) => ({ ...line, originalIndex: index }))
            .filter(line => line.product_type === 'MANUFACTURABLE')
            .filter(line => getMfgLineSubType(line) === 'ADVANCED') as ManufacturableLine[],
        [orderLines]
    )

    const handleConfirmManufacturing = (data: Record<string, unknown>) => {
        if (editingLineIndex === null) return
        const newLines = [...orderLines]
        const line = newLines[editingLineIndex]
        newLines[editingLineIndex] = { ...line, manufacturing_data: data }
        setOrderLines(newLines)
        setEditingLineIndex(null)
    }

    const editingLineRaw = editingLineIndex !== null ? orderLines[editingLineIndex] : null
    const editingLine = editingLineRaw && getMfgLineSubType(editingLineRaw) === 'ADVANCED' ? editingLineRaw : null

    return (
        <div className="space-y-6">
            {advancedLines.length === 0 ? (
                <EmptyState
                    context="production"
                    variant="compact"
                    title="Sin configuración de fabricación"
                    description="Esta orden no tiene productos con fabricación avanzada."
                />
            ) : (
                <div className="flex flex-col gap-3">
                    {advancedLines.map((line) => (
                        <MfgLineCard
                            key={line.originalIndex}
                            line={line}
                            onConfigure={() => setEditingLineIndex(line.originalIndex)}
                        />
                    ))}
                </div>
            )}

            {editingLine && (
                <AdvancedManufacturingDrawer
                    open={editingLineIndex !== null}
                    onOpenChange={(open) => !open && setEditingLineIndex(null)}
                    product={{
                        ...editingLine,
                        id: editingLine.id as number,
                        requires_advanced_manufacturing: true,
                        mfg_enable_prepress: editingLine.mfg_enable_prepress ?? true,
                        mfg_enable_press: editingLine.mfg_enable_press ?? true,
                        mfg_enable_postpress: editingLine.mfg_enable_postpress ?? true
                    }}
                    onConfirm={handleConfirmManufacturing}
                />
            )}
        </div>
    )
}
