import type { AutoSaveStatus } from "@/hooks/useAutoSaveForm"

const PRIORITY: Record<AutoSaveStatus, number> = {
    error:   5,
    saving:  4,
    invalid: 3,
    dirty:   2,
    synced:  1,
    idle:    0,
}

/**
 * Returns the "worst" status from an array of autosave statuses.
 * Used to derive a single combined status when a row has multiple forms
 * (e.g. RecurrentRuleRow saves to two separate endpoints).
 */
export function useCombinedAutoSaveStatus(statuses: AutoSaveStatus[]): AutoSaveStatus {
    return statuses.reduce<AutoSaveStatus>(
        (worst, s) => (PRIORITY[s] > PRIORITY[worst] ? s : worst),
        "idle",
    )
}
