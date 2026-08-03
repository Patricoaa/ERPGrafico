import { describe, it, expect } from "vitest"
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createEntityFields } from "../entity-fields"
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

        it("resolves placement and fieldRole for all fields", () => {
            const fields = testFields.toCardFields(sampleEntity)
            fields.forEach((f) => {
                expect(f.placement).toBeDefined()
                expect(f.fieldRole).toBeDefined()
                expect(["title", "subtitle", "header", "detail"]).toContain(f.placement)
            })
        })

        it("auto-detects title from identifier field with id/number/code in key", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const codeField = fields.find(f => f.key === "code")
            expect(codeField).toBeDefined()
            expect(codeField!.placement).toBe("title")
        })

        it("assigns status to header zone", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const statusField = fields.find(f => f.key === "status")
            expect(statusField).toBeDefined()
            expect(statusField!.placement).toBe("header")
            expect(statusField!.fieldRole).toBe("primary-value")
        })

        it("assigns currency to header zone", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const totalField = fields.find(f => f.key === "amount")
            expect(totalField).toBeDefined()
            expect(totalField!.placement).toBe("header")
            expect(totalField!.fieldRole).toBe("primary-value")
        })

        it("assigns name text fields to subtitle zone", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const nameField = fields.find(f => f.key === "name")
            expect(nameField).toBeDefined()
            expect(nameField!.placement).toBe("subtitle")
        })

        it("respects explicit placement override", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio" },
                name: { key: "name", type: "text", label: "Nombre", placement: "header" },
            }).toCardFields(sampleEntity)
            const nameField = fields.find(f => f.key === "name")
            expect(nameField!.placement).toBe("header")
        })

        it("respects explicit fieldRole override", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio" },
                name: { key: "name", type: "text", label: "Nombre", fieldRole: "relation" },
            }).toCardFields(sampleEntity)
            const nameField = fields.find(f => f.key === "name")
            expect(nameField!.fieldRole).toBe("relation")
            expect(nameField!.placement).toBe("detail")
        })

        it("ensures exactly one title field", () => {
            const fields = testFields.toCardFields(sampleEntity)
            const titles = fields.filter(f => f.placement === "title")
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
            expect(fields[0].key).toBe("amount")
            expect(fields[1].key).toBe("status")
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

    describe("column ordering", () => {
        it("sorts columns by placement zone, mirroring the card subtitle composition", () => {
            const fields = createEntityFields<TestEntity>()({
                detail_a: { key: "name", type: "text", label: "Detail A" },
                header_a: { key: "status", type: "status", label: "Header A" },
                title_a: { key: "code", type: "code", label: "Title A" },
                detail_b: { key: "description", type: "text", label: "Detail B" },
            })
            const columns = fields.toColumns()
            // title(0) → subtitle(1, card role order: name → primary-value) → detail(2)
            // name and status join the subtitle zone exactly like the card's auto-subtitle.
            expect(getAccessorKey(columns[0])).toBe("code")          // title zone
            expect(getAccessorKey(columns[1])).toBe("name")          // subtitle (name slot)
            expect(getAccessorKey(columns[2])).toBe("status")        // subtitle (primary-value slot)
            expect(getAccessorKey(columns[3])).toBe("description")   // detail zone
        })

        it("uses explicit placement over type-derived placement", () => {
            const fields = createEntityFields<TestEntity>()({
                a: { key: "name", type: "text", label: "A", placement: "title" },
                b: { key: "code", type: "code", label: "B" },
            })
            const columns = fields.toColumns()
            // 'name' is explicitly title(0), 'code' is type-derived header(3)
            expect(getAccessorKey(columns[0])).toBe("name")
            expect(getAccessorKey(columns[1])).toBe("code")
        })

        it("falls back to type-derived placement when no explicit placement", () => {
            const fields = createEntityFields<TestEntity>()({
                a: { key: "status", type: "status", label: "Status" },   // primary-value → subtitle (card role order)
                b: { key: "name", type: "text", label: "Name" },         // name → subtitle
                c: { key: "code", type: "code", label: "Code" },         // identifier → title(0)
            })
            const columns = fields.toColumns()
            // title(0) → subtitle(1): name → status (same role order as the card)
            expect(getAccessorKey(columns[0])).toBe("code")
            expect(getAccessorKey(columns[1])).toBe("name")
            expect(getAccessorKey(columns[2])).toBe("status")
        })

        it("preserves definition order within same placement zone", () => {
            const fields = createEntityFields<TestEntity>()({
                a: { key: "name", type: "text", label: "A" },     // detail(3)
                b: { key: "description", type: "text", label: "B" }, // detail(3)
                c: { key: "email", type: "text", label: "C" },    // detail(3)
            })
            const columns = fields.toColumns()
            // All detail zone — definition order preserved
            expect(getAccessorKey(columns[0])).toBe("name")
            expect(getAccessorKey(columns[1])).toBe("description")
            expect(getAccessorKey(columns[2])).toBe("email")
        })

        it("auto-titles first identifier field with code/id/display in key (no explicit placement)", () => {
            const fields = createEntityFields<TestEntity>()({
                chip: { key: "status", type: "chip", label: "Status" },      // header(2) — tag
                identifier: { key: "internal_code", type: "code", label: "ID" }, // auto-title(0)
                detail: { key: "name", type: "text", label: "Name" },         // subtitle(1) — name slot
            })
            const columns = fields.toColumns()
            // identifier should be first (title zone) due to auto-title detection;
            // name joins the subtitle zone (card name slot) before the tag chip.
            expect(getAccessorKey(columns[0])).toBe("internal_code")
            expect(getAccessorKey(columns[1])).toBe("name")
            expect(getAccessorKey(columns[2])).toBe("status")
        })

        it("respects fieldRole as fallback when no explicit placement", () => {
            const fields = createEntityFields<TestEntity>()({
                a: { key: "period_display", type: "computed", label: "Period", fieldRole: "identifier", render: () => null },
                b: { key: "status", type: "status", label: "Status" },
                c: { key: "name", type: "text", label: "Name" },
            })
            const columns = fields.toColumns()
            // 'a' has fieldRole:'identifier' → title via fallback chain (no code/id/display in key)
            // 'c' name → subtitle (name slot), 'b' status → subtitle (primary-value slot)
            expect(getAccessorKey(columns[0])).toBe("period_display")
            expect(getAccessorKey(columns[1])).toBe("name")
            expect(getAccessorKey(columns[2])).toBe("status")
        })

        it("falls back to first identifier field when no auto-title match", () => {
            const fields = createEntityFields<TestEntity>()({
                a: { key: "name", type: "text", label: "Name" },         // detail(3)
                b: { key: "code", type: "code", label: "Code" },         // identifier → fallback title(0)
            })
            const columns = fields.toColumns()
            // 'code' is the only identifier → gets title via fallback chain
            expect(getAccessorKey(columns[0])).toBe("code")
            expect(getAccessorKey(columns[1])).toBe("name")
        })

        it("falls back to first field when no identifier exists at all", () => {
            const fields = createEntityFields<TestEntity>()({
                a: { key: "name", type: "text", label: "Name" },     // detail(3) → fallback title(0)
                b: { key: "description", type: "text", label: "Desc" }, // detail(3)
            })
            const columns = fields.toColumns()
            // First field gets title via fallback chain
            expect(getAccessorKey(columns[0])).toBe("name")
            expect(getAccessorKey(columns[1])).toBe("description")
        })

        it("mirrors the card's auto-composed subtitle in role order (journal-entry case)", () => {
            const fields = createEntityFields<TestEntity>()({
                display: { key: "code", type: "code", label: "Folio" },
                status: { key: "status", type: "status", label: "Estado" },
                origin: { key: "origin", type: "chip", label: "Origen", placement: "subtitle", get: () => "Manual" },
                date: { key: "date", type: "date", label: "Fecha" },
                description: { key: "description", type: "text", label: "Descripción" },
                total: { key: "amount", type: "currency", label: "Total Débito", get: (e) => parseFloat(e.amount) },
            })
            const columns = fields.toColumns()
            // title(0) → subtitle(1): temporal(date) → primary-value(status) → explicit(origin)
            // → detail(2): description → header(3): total — KPIs last, before actions.
            expect(getAccessorKey(columns[0])).toBe("code")
            expect(getAccessorKey(columns[1])).toBe("date")
            expect(getAccessorKey(columns[2])).toBe("status")
            expect(getAccessorKey(columns[3])).toBe("origin")
            expect(getAccessorKey(columns[4])).toBe("description")
            expect(getAccessorKey(columns[5])).toBe("amount")
        })

        it("puts name first in subtitle zone, then temporal/primary-value, then explicit subtitle fields", () => {
            const fields = createEntityFields<TestEntity>()({
                display: { key: "code", type: "code", label: "Folio" },
                name: { key: "name", type: "text", label: "Nombre" },
                date: { key: "date", type: "date", label: "Fecha" },
                status: { key: "status", type: "status", label: "Estado" },
                tag: { key: "origin", type: "chip", label: "Origen", placement: "subtitle", get: () => "Manual" },
            })
            const columns = fields.toColumns()
            expect(getAccessorKey(columns[0])).toBe("code")
            expect(getAccessorKey(columns[1])).toBe("name")
            expect(getAccessorKey(columns[2])).toBe("date")
            expect(getAccessorKey(columns[3])).toBe("status")
            expect(getAccessorKey(columns[4])).toBe("origin")
        })

        it("mirrors card header priority within the header zone (total before status)", () => {
            const fields = createEntityFields<TestEntity>()({
                display: { key: "code", type: "code", label: "Folio" },
                status: { key: "status", type: "status", label: "Estado", placement: "header" },
                total: { key: "total_amount", type: "currency", label: "Total", placement: "header", get: (e) => parseFloat(e.amount) },
                description: { key: "description", type: "text", label: "Descripción" },
            })
            const columns = fields.toColumns()
            expect(getAccessorKey(columns[0])).toBe("code")
            // header zone (last, before actions): total/salary primary-value (rank 1)
            // before generic primary-value (rank 2); detail zone (2) sorts before header (3)
            expect(getAccessorKey(columns[1])).toBe("description")
            expect(getAccessorKey(columns[2])).toBe("total_amount")
            expect(getAccessorKey(columns[3])).toBe("status")
        })
    })

    describe("zone font-weight (ADR-0067)", () => {
        it("renders header zone cells semibold, title/detail zone cells normal", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio" },        // title(0)
                total: { key: "total_amount", type: "currency", label: "Total", placement: "header" }, // header(3)
                description: { key: "description", type: "text", label: "Descripción" }, // detail(2)
            })
            const columns = fields.toColumns()
            const cellMarkup = (col: ColumnDef<TestEntity>): string =>
                renderToStaticMarkup(
                    createElement(
                        React.Fragment,
                        null,
                        (col.cell as unknown as (ctx: { row: { original: TestEntity } }) => React.ReactNode)({
                            row: { original: sampleEntity },
                        }),
                    ),
                )

            expect(cellMarkup(columns[0])).toContain("font-medium")
            expect(cellMarkup(columns[0])).not.toContain("font-bold")
            expect(cellMarkup(columns[2])).toContain("font-semibold")
            expect(cellMarkup(columns[2])).not.toContain("font-bold")
            expect(cellMarkup(columns[1])).toContain("font-medium")
            expect(cellMarkup(columns[1])).not.toContain("font-bold")
        })
    })

    describe("meta.title", () => {
        it("resolveTitle uses meta.title.field", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio" },
                name: { key: "name", type: "text", label: "Nombre" },
            }, {
                title: { field: "name" },
            })
            const title = fields.resolveTitle(sampleEntity)
            expect(title).toBeTruthy()
        })

        it("resolveTitle uses meta.title.template", () => {
            const fields = createEntityFields<{ month: string; year: string }>()({
                m: { key: "month", type: "text", label: "Month" },
                y: { key: "year", type: "text", label: "Year" },
            }, {
                title: { field: "month", template: "{month} {year}" },
            })
            const title = fields.resolveTitle({ month: "Enero", year: "2026" })
            expect(title).toBe("Enero 2026")
        })

        it("resolveTitle falls back to placement:'title' field", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio", placement: "title" },
                name: { key: "name", type: "text", label: "Nombre" },
            })
            const title = fields.resolveTitle(sampleEntity)
            expect(title).toBeTruthy()
        })

        it("resolveTitle falls back to first field when no meta or placement", () => {
            const fields = createEntityFields<TestEntity>()({
                name: { key: "name", type: "text", label: "Nombre" },
            })
            const title = fields.resolveTitle(sampleEntity)
            expect(title).toBeTruthy()
        })
    })

    describe("meta.subtitle", () => {
        it("resolveSubtitle uses meta.subtitle.field", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio" },
                name: { key: "name", type: "text", label: "Nombre" },
            }, {
                subtitle: { field: "name" },
            })
            const subtitle = fields.resolveSubtitle(sampleEntity)
            expect(subtitle).toHaveLength(1)
            expect(subtitle[0].kind).toBe("text")
        })

        it("resolveSubtitle uses meta.subtitle.template", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio" },
                name: { key: "name", type: "text", label: "Nombre" },
            }, {
                subtitle: { template: "{code} · {name}" },
            })
            const subtitle = fields.resolveSubtitle(sampleEntity)
            expect(subtitle.length).toBeGreaterThan(0)
        })

        it("resolveSubtitle returns empty when no meta", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio" },
            })
            const subtitle = fields.resolveSubtitle(sampleEntity)
            expect(subtitle).toHaveLength(0)
        })

        it("resolveSubtitle excludes null fields from template", () => {
            const fields = createEntityFields<TestEntity>()({
                code: { key: "code", type: "code", label: "Folio" },
                name: { key: "name", type: "text", label: "Nombre" },
            }, {
                subtitle: { template: "{code} · {?name}" },
            })
            const entityNoName = { ...sampleEntity, name: "" }
            const subtitle = fields.resolveSubtitle(entityNoName)
            expect(subtitle.length).toBeGreaterThan(0)
        })

        it("resolveSubtitle does not consume tag-role fields as subtitle slots", () => {
            const fields = createEntityFields<{ name: string; roles: string[] }>()({
                name: { key: "name", type: "text", label: "Nombre" },
                roles: { key: "roles", type: "chip-category", label: "Roles", domain: "contact_type",
                         get: (e) => e.roles },
            })
            const subtitle = fields.resolveSubtitle({ name: "Test", roles: ["admin"] })
            expect(subtitle).toHaveLength(1)
            expect(subtitle[0].kind).toBe("text")
        })

        it("skips an absent primary-value candidate and promotes the next present one", () => {
            const fields = createEntityFields<{ total: number; status: string }>()({
                id: { key: "id", type: "code", label: "ID" },
                total: { key: "total_amount", type: "currency", label: "Total", get: () => 1500 },
                status: { key: "status", type: "status", label: "Estado", get: (e) => e.status },
            })
            // total_amount has no raw value on the entity (computed via `get`), so the
            // primary-value slot must continue to the next candidate: status.
            const subtitle = fields.resolveSubtitle({ total: 1500, status: "OPEN" }, fields.toCardFields({ total: 1500, status: "OPEN" }))
            const kinds = subtitle.map(s => s.kind)
            expect(kinds).toContain("status")
            expect(kinds).not.toContain("currency")
        })

        it("skips an absent name candidate and promotes the next present name field", () => {
            const fields = createEntityFields<{ user_name: string; terminal_name: string }>()({
                id: { key: "id", type: "code", label: "ID" },
                user_name: { key: "user_name", type: "text", label: "Cajero" },
                terminal_name: { key: "terminal_name", type: "text", label: "Terminal" },
            })
            const subtitle = fields.resolveSubtitle(
                { user_name: "", terminal_name: "Caja 1" },
                fields.toCardFields({ user_name: "", terminal_name: "Caja 1" }),
            )
            expect(subtitle).toHaveLength(1)
            const [nameItem] = subtitle
            expect(nameItem.kind).toBe("text")
            if (nameItem.kind === "text") {
                expect(nameItem.content).toBe("Caja 1")
            }
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
            currencyFlow: 1000,
        }

        it("generates columns for all types", () => {
            const columns = allTypeFields.toColumns()
            expect(columns).toHaveLength(9)
        })

        it("generates card fields for all types", () => {
            const fields = allTypeFields.toCardFields(entity as never)
            expect(fields).toHaveLength(9)
            fields.forEach((f) => {
                expect(f.key).toBeTruthy()
                expect(f.label).toBeTruthy()
                expect(f.value).toBeTruthy()
            })
        })

        it("generates kanban fields for all types", () => {
            const fields = allTypeFields.toKanbanFields(entity as never)
            expect(fields).toHaveLength(9)
        })
    })
})
