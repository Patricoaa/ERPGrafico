import { describe, expect, it } from "vitest"
import { readValue } from "@/components/entity-view"
import { posSessionEntity } from "../posSession.entity"
import type { POSSession } from "../../components/POSSessionsClientView"

describe("posSessionEntity (TC-065)", () => {
    it("adds cash and card sales sent by DRF as decimal strings", () => {
        // The API serializes DecimalField as strings; the TS type says number.
        const session = { id: 7, total_cash_sales: "1000.00", total_card_sales: "500.00" } as unknown as POSSession
        expect(readValue(posSessionEntity.field("totalSales"), session)).toBe(1500)
    })
})
