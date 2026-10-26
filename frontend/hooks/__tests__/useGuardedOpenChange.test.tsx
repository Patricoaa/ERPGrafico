import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

import { useGuardedOpenChange } from "../useGuardedOpenChange"

describe("useGuardedOpenChange", () => {
    it("without a provider behaves like the original onOpenChange", () => {
        const onOpenChange = vi.fn()
        const { result } = renderHook(() => useGuardedOpenChange(onOpenChange))

        result.current(false)
        result.current(true)

        expect(onOpenChange).toHaveBeenNthCalledWith(1, false)
        expect(onOpenChange).toHaveBeenNthCalledWith(2, true)
    })
})
