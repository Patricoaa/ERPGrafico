"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

/**
 * Typed modes for screens that switch entity (orders ↔ notes, RC5 / TC-018).
 * Each mode renders its own `Collection.Root` with its own entity, so no cast is needed:
 * the notes card uses the notes fields. URL sync (`?view_mode=`) is wired by the page.
 */
export interface CollectionMode {
    label: string
    render: () => React.ReactNode
}

export interface CollectionModesProps<M extends string> {
    modes: Record<M, CollectionMode>
    value: M
    onChange: (mode: M) => void
    label: string
}

export function CollectionModes<M extends string>({ modes, value, onChange, label }: CollectionModesProps<M>) {
    const keys = Object.keys(modes) as M[]
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1" role="group" aria-label={label}>
                {keys.map((key) => (
                    <Button key={key} variant={key === value ? "secondary" : "ghost"} size="sm" aria-pressed={key === value} onClick={() => onChange(key)}>
                        {modes[key].label}
                    </Button>
                ))}
            </div>
            <React.Fragment key={value}>{modes[value].render()}</React.Fragment>
        </div>
    )
}
