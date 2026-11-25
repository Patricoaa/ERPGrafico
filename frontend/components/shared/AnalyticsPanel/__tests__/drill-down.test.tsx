import { describe, expect, it, vi } from "vitest"
import * as React from "react"
import { renderHook } from "@testing-library/react"
import { AnalyticsDrillDownProvider, useAnalyticsDrillDown, type ChartDrillDown } from "@/components/shared"

function setup(drillDown: ChartDrillDown | undefined, withProvider = true) {
    const onDrillDown = vi.fn()
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        withProvider ? <AnalyticsDrillDownProvider onDrillDown={onDrillDown}>{children}</AnalyticsDrillDownProvider> : <>{children}</>
    const { result } = renderHook(() => useAnalyticsDrillDown(drillDown), { wrapper })
    return { drill: result.current, onDrillDown }
}

describe("useAnalyticsDrillDown (ADR-0158 §11)", () => {
    it("sends the clicked category as the filter value", () => {
        const { drill, onDrillDown } = setup({ param: "customer_name" })
        drill?.("Viña Los Robles")
        expect(onDrillDown).toHaveBeenCalledWith({ param: "customer_name", value: "Viña Los Robles" })
    })

    it("translates display labels through `values` and ignores unmapped ones", () => {
        const { drill, onDrillDown } = setup({ param: "delivery_status", values: { Entregado: "DELIVERED" } })
        drill?.("Otros")
        expect(onDrillDown).not.toHaveBeenCalled()
        drill?.("Entregado")
        expect(onDrillDown).toHaveBeenCalledWith({ param: "delivery_status", value: "DELIVERED" })
    })

    it("is off without a `drillDown` declaration or without a listener", () => {
        expect(setup(undefined).drill).toBeNull()
        expect(setup({ param: "x" }, false).drill).toBeNull()
    })
})
