import { describe, expect, it, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

let pathname = "/accounting/ledger"
const pageHeader = vi.fn()

vi.mock("next/navigation", () => ({ usePathname: () => pathname }))
vi.mock("@/hooks/useViewModePreference", () => ({
    useViewModePreference: () => ({ getViewModeUrl: (_label: string, url: string) => url }),
}))
vi.mock("@/components/shared", () => ({
    PageHeader: (props: { title: string; navigation: { activeValue: string; subActiveValue?: string } }) => {
        pageHeader(props)
        return null
    },
}))

import { getAccountingConfigSubTab, getRcvSubTab } from "@/features/accounting/navigation"
import { AccountingHeader } from "../AccountingHeader"

function lastProps() {
    return pageHeader.mock.calls.at(-1)?.[0] as {
        title: string
        navigation: { activeValue: string; subActiveValue?: string; tabs: { value: string }[] }
    }
}

describe("AccountingHeader", () => {
    beforeEach(() => pageHeader.mockClear())

    it("includes the RCV tab in the module rail", () => {
        render(<AccountingHeader />)
        expect(lastProps().navigation.tabs.map((t) => t.value)).toContain("rcv")
    })

    it.each([
        ["/accounting/rcv/purchases", "purchases"],
        ["/accounting/rcv/sales", "sales"],
        ["/accounting/rcv/imports", "imports"],
        ["/accounting/rcv", "purchases"],
    ])("marks the RCV sub-tab of %s as active and uses its title", (path, sub) => {
        pathname = path
        render(<AccountingHeader />)
        const props = lastProps()
        expect(props.navigation.activeValue).toBe("rcv")
        expect(props.navigation.subActiveValue).toBe(sub)
        expect(props.title).toBe(getRcvSubTab(sub)?.headerTitle)
    })

    it("marks the RCV / SII config sub-tab as active", () => {
        pathname = "/accounting/settings/rcv"
        render(<AccountingHeader />)
        const props = lastProps()
        expect(props.navigation.activeValue).toBe("config")
        expect(props.navigation.subActiveValue).toBe("rcv")
        expect(props.title).toBe(getAccountingConfigSubTab("rcv")?.headerTitle)
    })
})
