import type { TreasuryMovement } from "../types"

/**
 * One side of a movement's origin → destination path. Treasury accounts and contacts are
 * linkable in the UI; `text` is a plain label (e.g. "Particular" for a cash counterparty).
 */
export type MovementEndpoint =
    | { kind: "treasury"; id: number; name: string }
    | { kind: "contact"; id: number; name: string }
    | { kind: "text"; name: string }

export interface MovementPathValue {
    from: MovementEndpoint
    to: MovementEndpoint
}

const label = (name: string): MovementEndpoint => ({ kind: "text", name })

function accountEndpoint(
    id: number | null | undefined,
    name: string | null | undefined,
): MovementEndpoint | null {
    if (id === null || id === undefined) return null
    return { kind: "treasury", id, name: name?.trim() || `Cuenta #${id}` }
}

function partnerEndpoint(m: TreasuryMovement): MovementEndpoint | null {
    const name = m.partner_name?.trim()
    if (!name) return null
    return m.partner_id !== null && m.partner_id !== undefined
        ? { kind: "contact", id: m.partner_id, name }
        : label(name)
}

/**
 * Resolves the origin/destination of a treasury movement.
 *
 * INBOUND: counterparty → treasury account (the money enters the account).
 * OUTBOUND: treasury account → counterparty (the money leaves the account).
 * TRANSFER / ADJUSTMENT: treasury account → treasury account, falling back to the
 * counterparty when a legacy record only has one side.
 */
export function movementEndpoints(m: TreasuryMovement): MovementPathValue {
    const fromAccount = accountEndpoint(m.from_account, m.from_account_name)
    const toAccount = accountEndpoint(m.to_account, m.to_account_name)
    const partner = partnerEndpoint(m)

    if (m.movement_type === "INBOUND") {
        return {
            from: partner ?? label("Particular"),
            to: toAccount ?? fromAccount ?? label("Cuenta"),
        }
    }

    if (m.movement_type === "OUTBOUND") {
        return {
            from: fromAccount ?? toAccount ?? label("Cuenta"),
            to: partner ?? label("Particular"),
        }
    }

    return {
        from: fromAccount ?? partner ?? label("Origen"),
        to: toAccount ?? (partner && !fromAccount ? partner : label("Destino")),
    }
}

export function formatMovementEndpoint(endpoint: MovementEndpoint): string {
    return endpoint.name
}

export function formatMovementPath(path: MovementPathValue): string {
    return `${formatMovementEndpoint(path.from)} → ${formatMovementEndpoint(path.to)}`
}
