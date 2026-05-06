"use client"

import { useEffect } from "react"
import type { AutoSaveStatus } from "./useAutoSaveForm"

const PENDING_STATUSES: ReadonlySet<AutoSaveStatus> = new Set<AutoSaveStatus>([
    "dirty",
    "saving",
    "invalid",
])

/**
 * Warns the user via `beforeunload` if they try to close the tab while a save
 * is pending, in flight, or blocked by validation. Pair with
 * {@link useAutoSaveForm}; pass its `status` as the first argument.
 *
 * Note: browsers ignore the custom `returnValue` text in modern versions and
 * show a generic dialog. The hook only attaches the listener while a relevant
 * status is active to avoid false positives elsewhere on the page.
 */
export function useUnsavedChangesGuard(status: AutoSaveStatus): void {
    useEffect(() => {
        if (!PENDING_STATUSES.has(status)) return
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ""
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [status])
}
