import { describe, expect, it, vi } from "vitest"

import { thisYear } from "@/lib/date-presets"

vi.mock("@/components/entity-view", () => ({
    defineEntity: () => (build: (f: Record<string, unknown>) => Record<string, unknown>) => {
        const fields = {
            text: (id: string, options: object) => ({ id, kind: "text", ...options }),
            dateRange: (_get: unknown, options: object) => ({ id: "period", kind: "dateRange", ...options }),
            date: (id: string, options: object) => ({ id, kind: "date", ...options }),
        }
        const spec = build(fields)
        return {
            ...spec,
            ids: Object.keys(spec.fields as object),
            views: (views: unknown) => views,
        }
    },
}))

import { budgetEntity } from "../budget.entity"

describe("budgetEntity.query (ADR-0158)", () => {
    it("busca y filtra el periodo con los parámetros DRF del viewset", () => {
        expect(budgetEntity.query?.search).toMatchObject({ placeholder: "Buscar presupuestos…" })
        expect(budgetEntity.query?.filters?.period).toMatchObject({
            field: "period",
            control: "date",
            paramFrom: "start_date__gte",
            paramTo: "end_date__lte",
        })
    })

    it("declara claves de orden del servidor sin sorting client", () => {
        expect(budgetEntity.fields.name.orderBy).toBe("name")
        expect(budgetEntity.fields.startDate.orderBy).toBe("start_date")
        expect(budgetEntity.fields.endDate.orderBy).toBe("end_date")
        expect(budgetEntity.query?.sort).toMatchObject({
            fields: ["name", "startDate", "endDate"],
            default: "-startDate",
        })
    })

    it("precarga el rango de la vista «Este año»", () => {
        const currentYear = thisYear()
        expect(budgetEntity.query?.views).toEqual([
            { id: "all", label: "Todos" },
            {
                id: "this-year",
                label: "Este año",
                filters: { period: [currentYear.from, currentYear.to] },
            },
        ])
    })
})
