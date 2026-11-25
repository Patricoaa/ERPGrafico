import { describe, expect, it } from "vitest"
import { compileQuery, orderingFor } from "@/components/entity-view"
import { saleOrderEntity } from "../saleOrder.entity"
import { saleNoteEntity } from "../saleNote.entity"
import { saleDeliveryEntity } from "../saleDelivery.entity"
import { saleReturnEntity } from "../saleReturn.entity"
import { saleFulfillmentEntity } from "../saleFulfillment.entity"

/** The command-bar pilot (ADR-0158 stage 3c): the query must speak `SaleOrderFilterSet`'s params. */
describe("saleOrderEntity.query", () => {
    const compiled = compileQuery(saleOrderEntity)

    it("keeps the URL params of the former unifiedSearchDef, so old links still filter", () => {
        expect(compiled.filterParams).toMatchObject({
            date: ["date_after", "date_before"],
            origin_status: ["origin_status"],
            delivery_status: ["delivery_status"],
            billing_status: ["billing_status"],
            payment_status: ["payment_status"],
            production_status: ["production_status"],
            total: ["total_min", "total_max"],
        })
        expect(compiled.search.searchFields?.map((f) => f.serverParam)).toEqual(["customer_name", "number", "product_name"])
    })

    it("sorts by date descending by default, with the server keys the viewset allows", () => {
        expect(orderingFor(compiled, compiled.defaultSort)).toBe("-date,-id")
        expect(orderingFor(compiled, ["customer", "-total"])).toBe("customer__name,-total,id")
    })

    it("offers predefined views on filters the list knows", () => {
        expect(compiled.views.map((v) => v.id)).toEqual(["all", "to-deliver", "to-invoice", "to-collect", "drafts"])
        for (const view of compiled.views) {
            for (const key of Object.keys(view.filters ?? {})) expect(compiled.filterParams).toHaveProperty(key)
        }
    })
})

describe("sales entity queries (ADR-0158 wave 3d-1)", () => {
    const entities = { saleNoteEntity, saleDeliveryEntity, saleReturnEntity, saleFulfillmentEntity }

    it.each(Object.entries(entities))("%s compiles, names its search box and only views on known filters", (_, entity) => {
        const compiled = compileQuery(entity)
        expect(compiled.placeholder).not.toBe("Buscar…")
        for (const view of compiled.views) {
            for (const key of Object.keys(view.filters ?? {})) expect(compiled.filterParams).toHaveProperty(key)
        }
    })

    it("does not offer sorting where the server cannot sort the whole list", () => {
        expect(compileQuery(saleNoteEntity).sortFields).toEqual([])
        expect(compileQuery(saleFulfillmentEntity).sortFields).toEqual([])
        expect(orderingFor(compileQuery(saleDeliveryEntity), ["-date"])).toBe("-delivery_date,-id")
    })
})
