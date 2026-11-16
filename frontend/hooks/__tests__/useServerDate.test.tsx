import { describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const get = vi.hoisted(() => vi.fn())
vi.mock("@/lib/api", () => ({ default: { get } }))

import { useServerDate } from "../useServerDate"

function setup(debugTools: boolean) {
    get.mockResolvedValue({
        data: { datetime: "2026-11-13T20:35:00+00:00", date: "2026-11-13", year: 2026, month: 11, day: 13, timezone: "America/Santiago", debug_tools: debugTools },
    })
    const client = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const hook = renderHook(() => useServerDate(), { wrapper })
    return { client, hook }
}

describe("useServerDate refetchInterval", () => {
    it("sondea cada 60 s solo con debug_tools", async () => {
        const { client, hook } = setup(true)
        await waitFor(() => expect(hook.result.current.debugTools).toBe(true))
        const opt = client.getQueryCache().find({ queryKey: ["server-time"] })!.observers[0].options.refetchInterval as (q: unknown) => unknown
        expect(opt(client.getQueryCache().find({ queryKey: ["server-time"] }))).toBe(60000)
    })

    it("no sondea sin debug_tools", async () => {
        const { client, hook } = setup(false)
        await waitFor(() => expect(hook.result.current.datetime).not.toBeNull())
        const q = client.getQueryCache().find({ queryKey: ["server-time"] })!
        const opt = q.observers[0].options.refetchInterval as (q: unknown) => unknown
        expect(opt(q)).toBe(false)
    })
})
