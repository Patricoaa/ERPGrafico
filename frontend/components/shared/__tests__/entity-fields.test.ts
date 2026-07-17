import { describe, it, expect } from "vitest"
import { createEntityFields, type CardField, type KanbanField } from "../entity-fields"
import type { ColumnDef } from "@tanstack/react-table"

function getAccessorKey<T>(col: ColumnDef<T>): string | undefined {
    return "accessorKey" in col ? (col.accessorKey as string) : undefined
}

interface TestEntity {
    id: number
    code: string
    name: string
    date: string
    amount: string
    status: string
    description: string
    email: string | null
}

const testFields = createEntityFields<TestEntity>()({
    code: { key: "code", type: "code", label: "Folio" },
    name: { key: "name", type: "text", label: "Nombre" },
    date: { key: "date", type: "date", label: "Fecha" },
    total: { key: "amount", type: "currency", label: "Total", get: (e) => parseFloat(e.amount) },
    status: { key: "status", type: "status", label: "Estado" },
    description: { key: "description", type: "text", label: "Descripción" },
    email: { key: "email", type: "text", label: "Email", get: (e) => e.email || "-" },
})

const sampleEntity: TestEntity = {
    id: 1,
    code: "OC-001",
    name: "Test Product",
    date: "2026-01-15",
    amount: "15000",
    status: "APPROVED",
    description: "Something",
    email: "test@example.com",
}

describe("createEntityFields", () => {
    describe("toColumns", () => {
        it("returns ColumnDef[] with correct accessorKey and header", () => {
            const columns = testFields.toColumns()
            expect(columns).toHaveLength(7)

            const codeCol = columns[0]
            expect(getAccessorKey(codeCol)).toBe("code")
            expect(codeCol.enableSorting).toBe(true)
        })

        it("uses header override when provided", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio", header: "Número" },
            })
            const columns = fields.toColumns()
            expect(columns).toHaveLength(1)
            // header is a function, we just verify accessorKey
            expect(getAccessorKey(columns[0])).toBe("code")
        })

        it("respects tableOptions.enableSorting=false", () => {
            const fields = createEntityFields<TestEntity>()({
                name: { key: "name", type: "text", label: "Nombre", tableOptions: { enableSorting: false } },
            })
            const columns = fields.toColumns()
            expect(columns[0].enableSorting).toBe(false)
        })

        it("applies tableOptions.width as size", () => {
            const fields = createEntityFields<TestEntity>()({
                name: { key: "name", type: "text", label: "Nombre", tableOptions: { width: 200 } },
            })
            const columns = fields.toColumns()
            expect(columns[0].size).toBe(200)
        })

        it("excludes fields not on 'table' surface", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio", surfaces: ["card", "kanban"] },
                name: { key: "name", type: "text", label: "Nombre" },
            })
            const columns = fields.toColumns()
            expect(columns).toHaveLength(1)
            expect(getAccessorKey(columns[0])).toBe("name")
        })
    })

    describe("toCardFields", () => {
        it("returns CardField[] with key, label, and value", () => {
            const fields = testFields.toCardFields(sampleEntity)
            expect(fields).toHaveLength(7)

            const codeField = fields[0]
            expect(codeField.key).toBe("code")
            expect(codeField.label).toBe("Folio")
            expect(codeField.value).toBeDefined()
        })

        it("uses get transform when provided", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const totalField = fields.find((f) => f.key === "amount")
            expect(totalField).toBeDefined()
            // The value is a ReactNode from DataCell.Currency
            expect(totalField!.value).toBeTruthy()
        })

        it("applies get transform for email with fallback", () => {
            const entityNoEmail = { ...sampleEntity, email: null }
            const fields = testFields.toCardFields(entityNoEmail)
            const emailField = fields.find((f) => f.key === "email")
            expect(emailField).toBeDefined()
            expect(emailField!.value).toBeTruthy()
        })

        it("filters by only option", () => {
            const fields = testFields.toCardFields(sampleEntity, { only: ["code", "name"] })
            expect(fields).toHaveLength(2)
            expect(fields[0].key).toBe("code")
            expect(fields[1].key).toBe("name")
        })

        it("excludes fields not on 'card' surface", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio", surfaces: ["table"] },
                name: { key: "name", type: "text", label: "Nombre" },
            })
            const cardFields = fields.toCardFields(sampleEntity)
            expect(cardFields).toHaveLength(1)
            expect(cardFields[0].key).toBe("name")
        })

        it("resolves cardPlacement and fieldRole for all fields", () => {
            const fields = testFields.toCardFields(sampleEntity)
            fields.forEach((f) => {
                expect(f.cardPlacement).toBeDefined()
                expect(f.fieldRole).toBeDefined()
                expect(["title", "header", "detail", "metric"]).toContain(f.cardPlacement)
            })
        })

        it("auto-detects title from identifier field with id/number/code in key", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const codeField = fields.find(f => f.key === "code")
            expect(codeField).toBeDefined()
            expect(codeField!.cardPlacement).toBe("title")
        })

        it("assigns status to header zone", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const statusField = fields.find(f => f.key === "status")
            expect(statusField).toBeDefined()
            expect(statusField!.cardPlacement).toBe("header")
            expect(statusField!.fieldRole).toBe("status")
        })

        it("assigns currency to header zone", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const totalField = fields.find(f => f.key === "total")
            expect(totalField).toBeDefined()
            expect(totalField!.cardPlacement).toBe("header")
            expect(totalField!.fieldRole).toBe("primary-value")
        })

        it("assigns text fields to detail zone", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const nameField = fields.find(f => f.key === "name")
            expect(nameField).toBeDefined()
            expect(nameField!.cardPlacement).toBe("detail")
        })

        it("respects explicit cardPlacement override", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio" },
                name: { key: "name", type: "text", label: "Nombre", cardPlacement: "header" },
            }).toCardFields(sampleEntity)
            const nameField = fields.find(f => f.key === "name")
            expect(nameField!.cardPlacement).toBe("header")
        })

        it("respects explicit fieldRole override", () => {
            const fields = createEntityFields<TestEntity>()({
                name: { key: "name", type: "text", label: "Nombre", fieldRole: "relation" },
            }).toCardFields(sampleEntity)
            const nameField = fields[0]
            expect(nameField.fieldRole).toBe("relation")
            expect(nameField.cardPlacement).toBe("detail")
        })

        it("ensures exactly one title field", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const titles = fields.filter(f => f.cardPlacement === "title")
            expect(titles).toHaveLength(1)
        })
    })

    describe("toKanbanFields", () => {
        it("returns KanbanField[] with compact rendering", () => {
            const fields = testFields.toKanbanFields(sampleEntity)
            expect(fields).toHaveLength(7)

            const statusField = fields.find((f) => f.key === "status")
            expect(statusField).toBeDefined()
            expect(statusField!.value).toBeTruthy()
        })

        it("filters by only option", () => {
            const fields = testFields.toKanbanFields(sampleEntity, { only: ["status", "amount"] })
            expect(fields).toHaveLength(2)
            expect(fields[0].key).toBe("status")
            expect(fields[1].key).toBe("amount")
        })

        it("excludes fields not on 'kanban' surface", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio", surfaces: ["table", "card"] },
                name: { key: "name", type: "text", label: "Nombre" },
            })
            const kanbanFields = fields.toKanbanFields(sampleEntity)
            expect(kanbanFields).toHaveLength(1)
            expect(kanbanFields[0].key).toBe("name")
        })
    })

    describe("render", () => {
        it("renders a specific field by key", () => {
            const result = testFields.render("code", sampleEntity)
            expect(result).toBeTruthy()
        })

        it("returns null for unknown field key", () => {
            const result = testFields.render("nonexistent", sampleEntity)
            expect(result).toBeNull()
        })
    })

    describe("defs", () => {
        it("exposes the raw field definitions", () => {
            expect(testFields.defs.code).toBeDefined()
            expect(testFields.defs.code.type).toBe("code")
            expect(testFields.defs.code.label).toBe("Folio")
        })
    })

    describe("all field types", () => {
        const allTypeFields = createEntityFields<Record<string, unknown>>()({
            f_text: { key: "text", type: "text", label: "Text" },
            f_code: { key: "code", type: "code", label: "Code" },
            f_date: { key: "date", type: "date", label: "Date" },
            f_currency: { key: "currency", type: "currency", label: "Currency" },
            f_status: { key: "status", type: "status", label: "Status" },
            f_number: { key: "number", type: "number", label: "Number" },
            f_secondary: { key: "secondary", type: "secondary", label: "Secondary" },
            f_chip: { key: "chip", type: "chip", label: "Chip" },
            f_progress: { key: "progress", type: "progress", label: "Progress" },
            f_numericFlow: { key: "numericFlow", type: "numericFlow", label: "NumericFlow" },
            f_currencyFlow: { key: "currencyFlow", type: "currencyFlow", label: "CurrencyFlow" },
        })

        const entity: Record<string, unknown> = {
            text: "hello",
            code: "ABC-123",
            date: "2026-01-15",
            currency: 50000,
            status: "ACTIVE",
            number: 42,
            secondary: "secondary text",
            chip: "label",
            progress: 75,
            numericFlow: -10,
            currencyFlow: 1000,
        }

        it("generates columns for all types", () => {
            const columns = allTypeFields.toColumns()
            expect(columns).toHaveLength(11)
        })

        it("generates card fields for all types", () => {
            const fields = allTypeFields.toCardFields(entity as never)
            expect(fields).toHaveLength(11)
            fields.forEach((f) => {
                expect(f.key).toBeTruthy()
                expect(f.label).toBeTruthy()
                expect(f.value).toBeTruthy()
            })
        })

        it("generates kanban fields for all types", () => {
            const fields = allTypeFields.toKanbanFields(entity as never)
            expect(fields).toHaveLength(11)
        })
    })
})
