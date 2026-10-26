import { render, screen, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"

import { DocumentRefLink } from "../DocumentRefLink"

const { openEntityMock, pushMock } = vi.hoisted(() => ({ openEntityMock: vi.fn(), pushMock: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openEntity: openEntityMock }),
}))

describe("DocumentRefLink", () => {
    beforeEach(() => { openEntityMock.mockReset(); pushMock.mockReset() })

    it("does not bubble the click to a clickable row (drawer drilldown)", () => {
        const rowClick = vi.fn()
        render(
            <div onClick={rowClick}>
                <DocumentRefLink label="contacts.contact" id={7} display="Cliente" mono={false} />
            </div>,
        )

        fireEvent.click(screen.getByRole("button", { name: "Cliente" }))

        expect(openEntityMock).toHaveBeenCalledWith("contacts.contact", 7, undefined, undefined, { display: "Cliente" })
        expect(rowClick).not.toHaveBeenCalled()
    })

    it("does not bubble the click when navigating to a list selection URL", () => {
        const rowClick = vi.fn()
        render(
            <div onClick={rowClick}>
                <DocumentRefLink label="sales.saleorder" id={9} display="OV-9" url="/sales/dtes/orders?selected=9" />
            </div>,
        )

        fireEvent.click(screen.getByRole("button", { name: "OV-9" }))

        expect(pushMock).toHaveBeenCalledWith("/sales/dtes/orders?selected=9", { scroll: false })
        expect(rowClick).not.toHaveBeenCalled()
    })
})
