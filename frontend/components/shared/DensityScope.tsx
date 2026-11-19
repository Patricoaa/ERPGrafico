import type { ReactNode } from "react"

export type DensityLevel = "compact" | "comfortable"
/** `auto` follows the pointer (coarse → touch); `touch`/`mouse` force it. */
export type InputMode = "auto" | "touch" | "mouse"

interface DensityScopeProps {
    /** Density of the subtree. Omit to inherit from the nearest ancestor scope. */
    density?: DensityLevel
    /** Input mode of the subtree. Omit to inherit from the nearest ancestor scope. */
    input?: InputMode
    children: ReactNode
}

/**
 * Sets the density dial for a subtree (ADR-0142): `data-density` / `data-input`
 * drive `--k`, which scales every spacing utility, the table tokens and (from
 * Phase 3) the control heights. Renders no box of its own (`display: contents`);
 * custom properties still inherit through it.
 *
 * Non-data primitive: no loading/empty/error states.
 */
export function DensityScope({ density, input, children }: DensityScopeProps) {
    return (
        <div data-density={density} data-input={input} className="contents">
            {children}
        </div>
    )
}
