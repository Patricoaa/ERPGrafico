import { describe, expectTypeOf, it } from "vitest"
import { defineEntity, defineEditable, type FieldId } from "@/components/entity-view"

interface Row {
    id: number
    name: string
    amount: string
    qty: number
    active: boolean
    created: string
}

/**
 * Compile-time guarantees (TY-1…TY-6). Each `@ts-expect-error` is an invalid configuration
 * that `npm run type-check` must reject; if one ever compiles, tsc fails on the unused directive.
 */
describe("entity-view · type guarantees", () => {
    const entity = defineEntity<Row>()((f) => ({
        title: "Prueba",
        fields: {
            name: f.text("name", { label: "Nombre" }),
            amount: f.money("amount", { label: "Monto" }),
            qty: f.quantity("qty", { label: "Cantidad", uom: "u" }),
            flow: f.flow("amount", { label: "Flujo", direction: (r) => (r.active ? "inflow" : "outflow") }),
            created: f.date("created", { label: "Creado" }),
        },
    }))

    it("infers field ids as a literal union", () => {
        expectTypeOf<FieldId<typeof entity.fields>>().toEqualTypeOf<"name" | "amount" | "qty" | "flow" | "created">()
    })

    it("rejects unknown keys and incompatible key types (TY-1, TY-2)", () => {
        defineEntity<Row>()((f) => ({
            title: "Prueba",
            fields: {
                // @ts-expect-error — "nmae" is not a key of Row
                typo: f.text("nmae", { label: "x" }),
                // @ts-expect-error — `active` is boolean, not a text value
                wrongType: f.text("active", { label: "x" }),
                // @ts-expect-error — accessor returns a number for a date field
                wrongAccessor: f.date((r) => r.qty, { label: "x" }),
            },
        }))
    })

    it("rejects invalid or missing options", () => {
        defineEntity<Row>()((f) => ({
            title: "Prueba",
            fields: {
                // @ts-expect-error — flow requires `direction`
                flowNoDirection: f.flow("amount", { label: "x" }),
                // @ts-expect-error — "sideways" is not a FlowDirection
                flowBadDirection: f.flow("amount", { label: "x", direction: "sideways" }),
                // @ts-expect-error — hubStatus requires `entity`
                hubNoEntity: f.hubStatus((r) => r, { label: "x", caption: { status: "DRAFT" } }),
                // @ts-expect-error — hubStatus requires a readable `caption` (Gate C: hub always labelled)
                hubNoCaption: f.hubStatus((r) => r, { label: "x", entity: "sales.saleorder" }),
                // @ts-expect-error — `decimals` is not an option of text
                textBadOption: f.text("name", { label: "x", decimals: 2 }),
            },
        }))
    })

    it("rejects unknown ids in layouts, exclusions and footers (TY-3, TC-012)", () => {
        const views = entity.views({
            table: { columns: ["name", "amount"], footer: { sum: ["amount"] } },
            card: { title: "name", trailing: ["amount"] },
        })
        views.table.without("amount")
        // @ts-expect-error — "work_order_summary" is a data key, not a field id
        views.table.without("work_order_summary")

        entity.views({
            // @ts-expect-error — "total" is not a field id
            table: { columns: ["name", "total"] },
        })
        entity.views({
            // @ts-expect-error — card title must be a field id
            card: { title: "folio" },
        })
        entity.views({
            // @ts-expect-error — defaultSort must be a field id or its "-id" form
            table: { columns: ["name"], defaultSort: "-folio" },
        })
    })

    it("rejects unregistered kinds (TY-4)", () => {
        defineEntity<Row>()((f) => ({
            title: "Prueba",
            fields: {
                // @ts-expect-error — "barcode" is not a registered ValueKind
                barcode: f.value("barcode", "name", { label: "x" }),
            },
        }))
    })

    it("types editable surfaces against the entity", () => {
        defineEditable(entity, {
            rowKey: (r) => r.id,
            // @ts-expect-error — context ids come from the entity
            context: ["name", "nope"],
            inputs: { take: { kind: "quantity", header: "Tomar", label: (r) => r.name } },
        })
        defineEditable(entity, {
            rowKey: (r) => r.id,
            context: ["name"],
            inputs: { take: { kind: "quantity", header: "Tomar", label: (r) => r.name } },
            // @ts-expect-error — footer sums only reference declared inputs
            footer: { sum: ["give"] },
        })
    })

    it("rejects an entity label that is not in ENTITY_REGISTRY (R8)", () => {
        defineEntity<Row>()((f) => ({
            // @ts-expect-error — "inventory.uomx" has no icon, drawer or URL in the registry
            label: "inventory.uomx",
            fields: { name: f.text("name", { label: "Nombre" }) },
        }))
    })
})
