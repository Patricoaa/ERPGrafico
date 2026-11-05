import { describe, expect, it } from "vitest"
import type { BankStatementLine } from "../../types"
import { buildReconciledGroups } from "../reconciledGroups"

function line(id: number, groupId?: number): BankStatementLine {
    return {
        id,
        line_number: id,
        reconciliation_status: "MATCHED",
        reconciliation_group_data: groupId === undefined ? undefined : {
            id: groupId,
            movements: [],
            batches: [],
            difference_amount: 0,
            difference_type: "",
            difference_type_display: "",
        },
    } as unknown as BankStatementLine
}

describe("buildReconciledGroups", () => {
    it("agrupa líneas que comparten grupo de conciliación", () => {
        const groups = buildReconciledGroups([line(1, 10), line(2, 10), line(3, 11)])
        expect(groups.map((g) => g.key)).toEqual(["group-10", "group-11"])
        expect(groups[0].lines.map((l) => l.id)).toEqual([1, 2])
    })

    it("no descarta líneas conciliadas sin grupo", () => {
        const groups = buildReconciledGroups([line(5)])
        expect(groups).toHaveLength(1)
        expect(groups[0].key).toBe("line-5")
        expect(groups[0].group).toBeNull()
        expect(groups[0].lines).toHaveLength(1)
    })
})
