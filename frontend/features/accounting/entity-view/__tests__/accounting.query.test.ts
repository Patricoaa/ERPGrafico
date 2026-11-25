import { describe, expect, it } from "vitest"
import { compileQuery } from "@/components/entity-view"
import { accountEntity } from "../account.entity"
import { closureEntity } from "../closure.entity"
import { journalEntryEntity } from "../journalEntry.entity"
import { rcvDocumentEntity, rcvSaleQueryEntity } from "../rcvDocument.entity"
import { rcvImportEntity } from "../rcvImport.entity"

/** ADR-0158 wave 3d-6: the accounting queries keep the params of the former unifiedSearchDef. */
describe("accounting entity queries", () => {
    it.each(Object.entries({ journalEntryEntity, rcvDocumentEntity, rcvSaleQueryEntity, rcvImportEntity }))(
        "%s compiles in server mode, without sort (no endpoint orders) and with known view filters",
        (_, entity) => {
            const compiled = compileQuery(entity)
            expect(compiled.sortFields).toEqual([])
            for (const view of compiled.views) {
                for (const key of Object.keys(view.filters ?? {})) expect(compiled.filterParams).toHaveProperty(key)
            }
        },
    )

    it("the chart of accounts and the closures compile in client mode; the tree of closures has no sort", () => {
        expect(compileQuery(accountEntity, { sorting: "client" }).sortFields.map((f) => f.id)).toContain("balance")
        expect(compileQuery(closureEntity, { sorting: "client" }).sortFields).toEqual([])
    })

    it("journal entries filter by date with the FilterSet params", () => {
        expect(compileQuery(journalEntryEntity).filterParams).toMatchObject({ date: ["date_after", "date_before"], status: ["status"] })
    })

    it("RCV purchases expose status and issue date; sales keep the date but drop status and acknowledgement", () => {
        const purchases = compileQuery(rcvDocumentEntity)
        expect(purchases.filterParams).toMatchObject({ status: ["status"], acknowledgement: ["acknowledgement"], issue_date: ["issue_date_from", "issue_date_to"] })
        const sales = compileQuery(rcvSaleQueryEntity)
        expect(sales.filterParams).not.toHaveProperty("status")
        expect(sales.filterParams).not.toHaveProperty("acknowledgement")
        expect(sales.filterParams).toHaveProperty("issue_date")
        expect(sales.placeholder).toBe("Buscar por cliente, RUT o folio…")
    })

    it("RCV purchases and sales filter by fiscal match status", () => {
        for (const entity of [rcvDocumentEntity, rcvSaleQueryEntity]) {
            const filter = compileQuery(entity).search.filters?.find((f) => f.key === "fiscal_match_status")
            const values = filter && "options" in filter ? (filter.options ?? []).map((o) => o.value) : []
            expect(values).toEqual(["MATCHED", "PENDING", "DIFF", "AMBIGUOUS", "MISSING_ERP", "MISSING_EXTERNAL", "EXCLUDED"])
        }
    })

    it("RCV imports have no search box", () => {
        expect(compileQuery(rcvImportEntity).searchBox).toBe(false)
    })
})
