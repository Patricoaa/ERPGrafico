import { describe, expect, it } from "vitest"
import { compileQuery, orderingFor } from "@/components/entity-view"
import { purchaseOrderEntity } from "../purchaseOrder.entity"
import { purchaseReceiptEntity } from "../purchaseReceipt.entity"
import { purchaseReturnEntity } from "../purchaseReturn.entity"
import { purchaseFulfillmentEntity } from "../purchaseFulfillment.entity"

/** ADR-0158 wave 3d-1: the queries must speak the purchasing FilterSets' params. */
describe("purchasing entity queries", () => {
    const entities = { purchaseOrderEntity, purchaseReceiptEntity, purchaseReturnEntity, purchaseFulfillmentEntity }

    it.each(Object.entries(entities))("%s compiles, names its search box and only views on known filters", (_, entity) => {
        const compiled = compileQuery(entity)
        expect(compiled.placeholder).not.toBe("Buscar…")
        for (const view of compiled.views) {
            for (const key of Object.keys(view.filters ?? {})) expect(compiled.filterParams).toHaveProperty(key)
        }
    })

    it("keeps the purchase order params of the former unifiedSearchDef", () => {
        expect(compileQuery(purchaseOrderEntity).filterParams).toMatchObject({
            created_at: ["created_at_after", "created_at_before"],
            receipt_date: ["receipt_date_after", "receipt_date_before"],
            receiving_status: ["receiving_status"],
            total: ["total_min", "total_max"],
        })
        expect(orderingFor(compileQuery(purchaseOrderEntity), ["-date"])).toBe("-date,-id")
    })

    it("does not offer sorting on the client-merged fulfillment list", () => {
        expect(compileQuery(purchaseFulfillmentEntity).sortFields).toEqual([])
        expect(orderingFor(compileQuery(purchaseReceiptEntity), ["supplier"])).toBe("purchase_order__supplier__name,id")
    })
})
