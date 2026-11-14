import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

const m = vi.hoisted(() => ({ startSync: vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve()) }))

vi.mock("../../hooks/useTerminalSync", () => ({ useStartTerminalSync: () => ({ startSync: m.startSync, isStarting: false }) }))

import { TerminalSyncModal } from "../TerminalSyncModal"

describe("TerminalSyncModal", () => {
    beforeEach(() => m.startSync.mockClear())

    it("con las fechas vacías envía un payload sin fechas y se cierra al encolar", async () => {
        const onOpenChange = vi.fn()
        render(<TerminalSyncModal open onOpenChange={onOpenChange} />)
        fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }))
        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
        expect(m.startSync).toHaveBeenCalledWith({})
    })

    it("si el encolado falla no se cierra", async () => {
        m.startSync.mockRejectedValueOnce(new Error("boom"))
        const onOpenChange = vi.fn()
        render(<TerminalSyncModal open onOpenChange={onOpenChange} />)
        fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }))
        await waitFor(() => expect(m.startSync).toHaveBeenCalled())
        expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })
})
