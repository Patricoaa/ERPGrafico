import { describe, expect, it } from "vitest"
import { compileQuery, orderingFor } from "@/components/entity-view"
import { saleOrderEntity } from "../saleOrder.entity"

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
