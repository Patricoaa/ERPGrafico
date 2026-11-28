import { describe, expect, it, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

let pathname = "/accounting/ledger"
let searchParamsString = ""
const pageHeader = vi.fn()

vi.mock("next/navigation", () => ({
    usePathname: () => pathname,
    useSearchParams: () => new URLSearchParams(searchParamsString),
}))
vi.mock("@/hooks/useViewModePreference", () => ({
    useViewModePreference: () => ({ getViewModeUrl: (_label: string, url: string) => url }),
}))
vi.mock("@/components/shared", () => ({
    PageHeader: (props: { title: string; navigation: { activeValue: string; subActiveValue?: string } }) => {
        pageHeader(props)
        return null
    },
}))

import { getRcvSubTab } from "@/features/accounting/navigation"
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

    it("does not crash when visiting former config routes", () => {
        pathname = "/accounting/settings/rcv"
        render(<AccountingHeader />)
        const props = lastProps()
        expect(props.title).toBe("Contabilidad")
    })
})
