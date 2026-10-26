import { describe, it, expect, beforeEach } from "vitest"

import { getPinnedDocuments, isPinned, togglePinnedDocument, MAX_PINNED_DOCUMENTS, PINNED_DOCUMENTS_STORAGE_KEY } from "../pinnedDocuments"

describe("pinnedDocuments", () => {
    beforeEach(() => window.localStorage.clear())

    it("pins and unpins a document", () => {
        togglePinnedDocument({ label: "sales.saleorder", id: 1, display: "OV-1" })
        expect(isPinned("sales.saleorder", 1)).toBe(true)
        togglePinnedDocument({ label: "sales.saleorder", id: 1, display: "OV-1" })
        expect(getPinnedDocuments()).toEqual([])
    })

    it("keeps the newest ones when the limit is reached", () => {
        for (let id = 1; id <= MAX_PINNED_DOCUMENTS + 2; id++) {
            togglePinnedDocument({ label: "sales.saleorder", id, display: `OV-${id}` })
        }
        expect(getPinnedDocuments().map((d) => d.id)).toEqual([3, 4, 5, 6, 7])
    })

    it("returns a stable snapshot and ignores corrupt storage", () => {
        togglePinnedDocument({ label: "billing.invoice", id: 2, display: "FAC-2" })
        expect(getPinnedDocuments()).toBe(getPinnedDocuments())
        window.localStorage.setItem(PINNED_DOCUMENTS_STORAGE_KEY, "{not json")
        expect(getPinnedDocuments()).toEqual([])
        window.localStorage.setItem(PINNED_DOCUMENTS_STORAGE_KEY, JSON.stringify([{ label: 1 }, { label: "a.b", id: 3, display: "X" }]))
        expect(getPinnedDocuments()).toEqual([{ label: "a.b", id: 3, display: "X" }])
    })
})
