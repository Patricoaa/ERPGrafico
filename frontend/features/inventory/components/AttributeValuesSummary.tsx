"use client"

import React, { createContext, useContext } from "react"
import { Plus, X } from "lucide-react"
import { DataCell, IconButton } from "@/components/shared"
import type { Attribute } from "@/features/inventory/hooks/useAttributes"

interface AttributeValuesCtx {
    onDeleteValue: (valueId: number) => void
    onAddValue: (attributeId: number) => void
}

const AttributeValuesContext = createContext<AttributeValuesCtx>({
    onDeleteValue: () => {},
    onAddValue: () => {},
})

export function AttributeValuesProvider({ value, children }: { value: AttributeValuesCtx; children: React.ReactNode }) {
    return (
        <AttributeValuesContext.Provider value={value}>
            {children}
        </AttributeValuesContext.Provider>
    )
}

export function AttributeValuesSummary({ attribute }: { attribute: Attribute }) {
    const { onDeleteValue, onAddValue } = useContext(AttributeValuesContext)
    const values = attribute.values || []

    return (
        <div className="flex flex-nowrap justify-center gap-1.5 w-full overflow-x-auto scrollbar-hide py-1">
            {values.map((val) => (
                <span
                    key={val.id}
                    className="inline-flex items-center gap-1 h-[22px] px-2.5 text-3xs font-mono font-bold uppercase tracking-widest rounded-full border border-border/50 bg-muted/60 text-muted-foreground"
                >
                    {val.value}
                    <IconButton
                        variant="ghost"
                        className="ml-0.5 h-3 w-3 p-0 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDeleteValue(val.id)
                        }}
                        title="Eliminar valor"
                    >
                        <X className="h-2.5 w-2.5" />
                    </IconButton>
                </span>
            ))}
            <IconButton
                className="!p-0 h-[22px] w-[22px] min-h-[22px] min-w-[22px] rounded-full bg-primary/5 hover:bg-primary/20 text-primary transition-all duration-300"
                onClick={() => onAddValue(attribute.id)}
                title="Añadir valor"
            >
                <Plus className="h-3.5 w-3.5" />
            </IconButton>
            {values.length === 0 && (
                <DataCell.Secondary className="text-muted-foreground/40 italic">
                    Sin valores
                </DataCell.Secondary>
            )}
        </div>
    )
}
