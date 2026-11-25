import { describe, expect, it } from "vitest"
import { compileQuery } from "@/components/entity-view"
import { bankEntity } from "../bank.entity"
import { paymentMethodEntity } from "../paymentMethod.entity"
import { terminalBatchEntity } from "../terminalBatch.entity"
import { terminalDeviceEntity } from "../terminalDevice.entity"
import { terminalProviderEntity } from "../terminalProvider.entity"
import { terminalSaleEntity } from "../terminalSale.entity"
import { terminalSyncRunEntity } from "../terminalSyncRun.entity"
import { treasuryAccountEntity } from "../treasuryAccount.entity"
import { treasuryMovementEntity } from "../treasuryMovement.entity"

/** ADR-0158 wave 3d-4: the treasury queries keep the params of the former unifiedSearchDef. */
describe("treasury entity queries", () => {
    const server = { treasuryMovementEntity, terminalSaleEntity, terminalSyncRunEntity }
    const client = { bankEntity, paymentMethodEntity, treasuryAccountEntity, terminalBatchEntity, terminalProviderEntity, terminalDeviceEntity }

    it.each(Object.entries(server))("%s compiles in server mode with known view filters and no sort", (_, entity) => {
        const compiled = compileQuery(entity)
        expect(compiled.sortFields).toEqual([])
        for (const view of compiled.views) {
            for (const key of Object.keys(view.filters ?? {})) expect(compiled.filterParams).toHaveProperty(key)
        }
    })

    it.each(Object.entries(client))("%s compiles in client mode with a named search box", (_, entity) => {
        const compiled = compileQuery(entity, { sorting: "client" })
        expect(compiled.searchBox).toBe(true)
        expect(compiled.placeholder).not.toBe("Buscar…")
    })

    it("movements keep the account link param and their amount range", () => {
        expect(compileQuery(treasuryMovementEntity).filterParams).toMatchObject({
            date: ["date_from", "date_to"],
            amount: ["amount_min", "amount_max"],
            treasury_account: ["treasury_account"],
            bank: ["bank"],
        })
        expect(compileQuery(treasuryMovementEntity).search.searchFields).toEqual([expect.objectContaining({ serverParam: "display_id" })])
    })

    it("terminal sales and sync runs hide the search box (their endpoints have no text search)", () => {
        for (const entity of [terminalSaleEntity, terminalSyncRunEntity]) expect(compileQuery(entity).searchBox).toBe(false)
        const dates = compileQuery(terminalSaleEntity).search.dateFilters?.[0]?.options.map((o) => o.label)
        expect(dates).toContain("Últimos 7 días")
    })

    it("browser-filtered lists keep the row keys they match", () => {
        expect(compileQuery(bankEntity, { sorting: "client" }).search.searchFields[0]).toMatchObject({ serverParam: "name", clientKey: ["name", "code"] })
        expect(compileQuery(terminalBatchEntity, { sorting: "client" }).search.searchFields.map((f) => f.serverParam)).toEqual(["batch_number", "provider_name"])
    })
})
