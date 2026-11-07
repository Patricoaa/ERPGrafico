"use client"

import { ArrowRight, Landmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataCell } from "@/components/shared"
import { registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { cn } from "@/lib/utils"
import {
    formatMovementPath,
    type MovementEndpoint,
    type MovementPathValue,
} from "../lib/movementPath"

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        movementPath: { value: MovementPathValue | null; options: Record<never, never> }
    }
}

/** Treasury account name that opens its drawer (same in-context pattern as EntityBadge). */
function TreasuryAccountLink({ endpoint }: { endpoint: Extract<MovementEndpoint, { kind: "treasury" }> }) {
    const { openEntity } = useGlobalModals()
    return (
        <Button
            type="button"
            variant="ghost"
            title={endpoint.name}
            onClick={(e) => {
                e.stopPropagation()
                openEntity("treasury.treasuryaccount", endpoint.id)
            }}
            className="group h-auto min-w-0 max-w-full justify-start gap-1 border-none bg-transparent p-0 text-xs font-medium text-foreground shadow-none hover:bg-transparent hover:text-primary hover:underline"
        >
            <Landmark className="h-3 w-3 flex-shrink-0 text-primary/50 transition-colors group-hover:text-primary" aria-hidden />
            <span className="truncate">{endpoint.name}</span>
        </Button>
    )
}

/** One side of the path: a treasury-account drawer link, a contact drawer link or plain text. */
export function MovementEndpointValue({ endpoint }: { endpoint: MovementEndpoint }) {
    if (endpoint.kind === "treasury") return <TreasuryAccountLink endpoint={endpoint} />

    if (endpoint.kind === "contact") {
        return (
            <DataCell.ContactLink contactId={endpoint.id} align="start" className="w-auto min-w-0 max-w-full">
                {endpoint.name}
            </DataCell.ContactLink>
        )
    }

    return (
        <span className="min-w-0 truncate text-xs text-muted-foreground" title={endpoint.name}>
            {endpoint.name}
        </span>
    )
}

/** Origin → destination path shared by the movement cards/table and the movement drawer. */
export function MovementPath({ value, className }: { value: MovementPathValue; className?: string }) {
    return (
        <div className={cn("flex min-w-0 items-center gap-1.5 overflow-hidden", className)}>
            <MovementEndpointValue endpoint={value.from} />
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden />
            <MovementEndpointValue endpoint={value.to} />
        </div>
    )
}

let registered = false

function registerMovementPathValueKind(): void {
    if (registered) return
    registered = true
    registerValueKind("movementPath", {
        format: (value) => (value ? formatMovementPath(value) : ""),
        render: ({ value }: ValueRenderProps<"movementPath">) =>
            value ? <MovementPath value={value} /> : <DataCell.Empty />,
    })
}

// The entity owns its extension: importing this module registers the kind.
registerMovementPathValueKind()
