import { describe, expect, it } from "vitest"
import { compileQuery, orderingFor } from "@/components/entity-view"
import { attributeEntity } from "../attribute.entity"
import { categoryEntity } from "../category.entity"
import { inventoryCountEntity } from "../inventoryCount.entity"
import { inventoryDocumentEntity } from "../inventoryDocument.entity"
import { pricingRuleEntity } from "../pricingRule.entity"
import { productEntity } from "../product.entity"
import { stockMoveEntity } from "../stockMove.entity"
import { stockReportEntity } from "../stockReport.entity"
import { uomCategoryEntity } from "../uomCategory.entity"
import { uomEntity } from "../uom.entity"
import { warehouseEntity } from "../warehouse.entity"

/** ADR-0158 wave 3d-3: the inventory queries keep the params of the former unifiedSearchDef. */
describe("inventory entity queries", () => {
    const server = { productEntity, stockMoveEntity, inventoryDocumentEntity, inventoryCountEntity }
    const client = { uomEntity, uomCategoryEntity, categoryEntity, attributeEntity, warehouseEntity, pricingRuleEntity, stockReportEntity }

    it.each(Object.entries(server))("%s compiles in server mode with known view filters", (_, entity) => {
        const compiled = compileQuery(entity)
        expect(compiled.placeholder).not.toBe("Buscar…")
        for (const view of compiled.views) {
            for (const key of Object.keys(view.filters ?? {})) expect(compiled.filterParams).toHaveProperty(key)
        }
    })

    it.each(Object.entries(client))("%s compiles in client mode", (_, entity) => {
        const compiled = compileQuery(entity, { sorting: "client" })
        expect(compiled.placeholder).not.toBe("Buscar…")
        expect(compiled.sortFields.every((f) => f.orderBy === null)).toBe(true)
    })

    it("products sort on the ProductViewSet ordering_fields and group by type or category", () => {
        const compiled = compileQuery(productEntity)
        expect(orderingFor(compiled, ["-stock"])).toBe("-annotated_current_stock,-id")
        expect(compiled.defaultSort).toEqual([])
        expect(compiled.groupFields.map((g) => g.id)).toEqual(["type", "category"])
        expect(compiled.search.searchFields[0]).toMatchObject({ serverParam: "search", suggestionsUrl: "inventory/products/filter-suggestions/" })
    })

    it("movements and documents keep their date params and offer no server sort", () => {
        expect(compileQuery(stockMoveEntity).filterParams).toMatchObject({ date: ["date_from", "date_to"], direction: ["direction"] })
        expect(compileQuery(inventoryDocumentEntity).filterParams).toMatchObject({ date: ["date_from", "date_to"], document_type: ["document_type"] })
        expect(compileQuery(stockMoveEntity).sortFields).toEqual([])
    })

    it("browser-filtered catalogs keep the row keys they match", () => {
        expect(compileQuery(warehouseEntity, { sorting: "client" }).search.searchFields[0]).toMatchObject({ serverParam: "name", clientKey: ["name", "code", "address"] })
        expect(compileQuery(categoryEntity, { sorting: "client" }).search.searchFields[0]).toMatchObject({ serverParam: "name", clientKey: ["name", "parent_name"] })
        expect(compileQuery(stockReportEntity, { sorting: "client" }).filterParams).toMatchObject({ warehouse: ["warehouse_id"], stock_qty: ["stock_qty_from", "stock_qty_to"] })
    })
})
