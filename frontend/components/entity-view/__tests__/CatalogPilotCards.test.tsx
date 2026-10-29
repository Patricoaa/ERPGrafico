import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { Collection, EntityViewProvider, useEntityCollection } from "@/components/entity-view"
import { workOrderEntity, workOrderViews } from "@/features/production/entity-view/workOrder.entity"
import { bomEntity, bomViews } from "@/features/production/entity-view/bom.entity"
import { treasuryAccountEntity, treasuryAccountViews } from "@/features/treasury/entity-view/treasuryAccount.entity"
import { contactEntity, contactViews } from "@/features/contacts/entity-view/contact.entity"
import { categoryEntity, categoryViews } from "@/features/inventory/entity-view/category.entity"
import { warehouseEntity, warehouseViews } from "@/features/inventory/entity-view/warehouse.entity"
import { groupEntity, groupViews } from "@/features/settings/entity-view/group.entity"
import { ENTITY_REGISTRY } from "@/lib/entity-registry"
import type { WorkOrder, BOM } from "@/features/production/types"
import type { TreasuryAccount } from "@/features/treasury/types"
import type { Contact } from "@/features/contacts/types"
import type { Category } from "@/features/inventory/hooks/useCategories"
import type { Warehouse } from "@/features/inventory/hooks/useWarehouses"
import type { Group } from "@/features/settings/api/types"

function Provider({ children }: { children: React.ReactNode }) {
    return <EntityViewProvider opener={{ open: vi.fn(), labelOf: () => undefined }}>{children}</EntityViewProvider>
}

function cards(label: string) {
    return within(screen.getByRole("list", { name: label })).getAllByRole("listitem")
}

const WORK_ORDERS = [
    {
        id: 1,
        display_id: "OT-001",
        number: "OT-001",
        main_product_id: 1,
        product_name: "Etiqueta",
        status: "IN_PROGRESS",
        current_stage: "PRESS",
        requires_prepress: false,
        requires_press: true,
        requires_postpress: false,
        is_manual: false,
        product_description: "Etiquetas adhesivas",
        sale_customer_name: "Imprenta Sur",
        quantity: 1000,
        uom_name: "Unidades",
        due_date: "2026-10-30",
        warehouse_name: "Bodega Central",
    },
    {
        id: 2,
        display_id: "OT-002",
        number: "OT-002",
        main_product_id: 2,
        product_name: "Volante",
        status: "CANCELLED",
        current_stage: "PREPRESS",
        requires_prepress: true,
        requires_press: false,
        requires_postpress: false,
        is_manual: false,
        product_description: "Volantes archivados",
        quantity: null,
    },
] as WorkOrder[]

const TREASURY_ACCOUNTS = [
    {
        id: 1,
        name: "Caja Principal",
        code: "CTA-001",
        currency: "CLP",
        account: 1,
        account_code: "1.1.01",
        account_name: "Caja General",
        bank: 1,
        bank_name: "Banco Estado",
        account_type: "CASH",
        account_type_display: "Caja",
        allows_cash: true,
        allows_card: false,
        allows_transfer: false,
        allows_check: false,
        is_system_managed: false,
        is_active: true,
        current_balance: 125000,
        terminal_providers: [],
    },
    {
        id: 2,
        name: "Caja antigua",
        code: "CTA-000",
        currency: "CLP",
        account: null,
        account_type: "CASH",
        account_type_display: "Caja",
        allows_cash: true,
        allows_card: false,
        allows_transfer: false,
        allows_check: false,
        is_system_managed: false,
        is_active: false,
        current_balance: 0,
        terminal_providers: [],
    },
] as TreasuryAccount[]

const CONTACTS = [
    {
        id: 1,
        code: null,
        display_id: "CON-001",
        name: "Ana Pérez",
        tax_id: "12345678-9",
        contact_type: "BOTH",
        active_roles: ["CUSTOMER", "SUPPLIER"],
        email: "ana@imprenta.cl",
        phone: "+56 9 1111 1111",
        address: null,
        city: null,
        payment_terms: null,
        is_default_customer: false,
        is_default_vendor: false,
        is_active: true,
        credit_enabled: true,
        credit_available: 50000,
        credit_blocked: false,
        credit_auto_blocked: false,
    },
    {
        id: 2,
        code: null,
        display_id: "CON-002",
        name: "Proveedor bloqueado",
        tax_id: null,
        contact_type: "SUPPLIER",
        active_roles: ["SUPPLIER"],
        email: null,
        phone: null,
        address: null,
        city: null,
        payment_terms: null,
        is_default_customer: false,
        is_default_vendor: false,
        is_active: false,
        credit_enabled: true,
        credit_available: null,
        credit_blocked: true,
        credit_auto_blocked: false,
    },
] as Contact[]

const BOMS = [
    {
        id: 1,
        product: 1,
        product_name: "Caja impresa",
        product_internal_code: "CAJ-001",
        name: "BOM v1",
        active: true,
        lines_count: 3,
        total_cost: 15000,
        yield_quantity: 10,
        yield_uom_name: "Cajas",
        lines: [],
    },
    {
        id: 2,
        product: 2,
        product_name: "Bolsa",
        product_internal_code: "BOL-001",
        name: "BOM archivada",
        active: false,
        lines_count: 1,
        total_cost: 2500,
        yield_quantity: 1,
        yield_uom_name: "Bolsa",
        lines: [],
    },
] as BOM[]

const CATEGORIES = [
    { id: 1, name: "Papeles", prefix: "PAP", parent: null, parent_name: null, asset_account: null, income_account: null, expense_account: null, icon: "package", is_active: true, product_count: 12 },
    { id: 2, name: "Antiguas", prefix: "OLD", parent: null, parent_name: null, asset_account: null, income_account: null, expense_account: null, icon: "package", is_active: false, product_count: 0 },
] as Category[]

const WAREHOUSES = [
    { id: 1, name: "Bodega Central", code: "WH-01", address: "Av. Principal 100", is_active: true, stocked_product_count: 4, stock_units: "25" },
    { id: 2, name: "Bodega antigua", code: "WH-00", address: "", is_active: false, stocked_product_count: 0, stock_units: "0" },
] as Warehouse[]

const GROUPS = [{ id: 1, name: "Ventas", user_count: 5 }] as Group[]

function WorkOrderHarness() {
    const collection = useEntityCollection(workOrderEntity, { rows: WORK_ORDERS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Órdenes de trabajo" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={workOrderViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function TreasuryHarness() {
    const collection = useEntityCollection(treasuryAccountEntity, { rows: TREASURY_ACCOUNTS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Cuentas de tesorería" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={treasuryAccountViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function ContactHarness() {
    const collection = useEntityCollection(contactEntity, { rows: CONTACTS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Contactos" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={contactViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function BomHarness() {
    const collection = useEntityCollection(bomEntity, { rows: BOMS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Listas de materiales" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={bomViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function CategoryHarness() {
    const collection = useEntityCollection(categoryEntity, { rows: CATEGORIES })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Categorías" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={categoryViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function WarehouseHarness() {
    const collection = useEntityCollection(warehouseEntity, { rows: WAREHOUSES })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Bodegas" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={warehouseViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function GroupHarness() {
    const collection = useEntityCollection(groupEntity, { rows: GROUPS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Grupos" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={groupViews.card} />
            </Collection.Root>
        </Provider>
    )
}

describe("Catalog card pilot (ADR-0097)", () => {
    it("WorkOrder defaults to the card view in its registry policy", () => {
        const policy = ENTITY_REGISTRY["production.workorder"].viewPolicy
        expect(policy?.availableViews).toContain("card")
        expect(policy?.defaultView).toBe("card")
    })

    it("WorkOrder uses the display folio, leads with customer, stage, quantity and delivery, and mutes cancelled orders", () => {
        render(<WorkOrderHarness />)
        const [active, cancelled] = cards("Órdenes de trabajo")
        expect(active).toHaveTextContent("OT-001")
        expect(active).toHaveTextContent("Imprenta Sur")
        expect(active).toHaveTextContent("Impresión")
        expect(active).toHaveTextContent("1.000 Unidades")
        expect(active).toHaveTextContent("Fecha Entrega")
        expect(active).toHaveTextContent("30/10/2026")
        expect(active).not.toHaveTextContent("Bodega Central")
        expect(active).not.toHaveTextContent("En Proceso")
        expect(active).not.toHaveTextContent("Activo")
        expect(cancelled).toHaveTextContent("Sin fecha")
        expect(cancelled.firstElementChild).toHaveClass("opacity-70")
    })

    it("TreasuryAccount replaces the code with the ledger account and shows the linked entity as a second badge", () => {
        render(<TreasuryHarness />)
        const [active, archived] = cards("Cuentas de tesorería")
        expect(active).toHaveTextContent("1.1.01 - Caja General")
        expect(active).not.toHaveTextContent("CTA-001")
        expect(active).toHaveTextContent("Caja")
        expect(active).toHaveTextContent("Banco Estado")
        expect(active).not.toHaveTextContent("Sin entidad externa")
        expect(active).toHaveTextContent("Saldo")
        expect(active).toHaveTextContent("125.000")
        expect(active).not.toHaveTextContent("Activo")
        expect(archived).toHaveTextContent("Archivada")
        expect(archived).not.toHaveTextContent("Sin entidad externa")
        expect(archived.firstElementChild).toHaveClass("opacity-70")
    })

    it("Contact shows one badge per role, flags blocked credit and pins the RUT in the footer", () => {
        render(<ContactHarness />)
        const [active, blocked] = cards("Contactos")
        expect(active).toHaveTextContent("Cliente")
        expect(active).toHaveTextContent("Proveedor")
        expect(active.querySelectorAll("[data-media-chips] > *")).toHaveLength(2)
        expect(active).toHaveTextContent("RUT / Identificación")
        expect(active).toHaveTextContent("12.345.678-9")
        expect(active).not.toHaveTextContent("Crédito disponible")
        expect(active).not.toHaveTextContent("Activo")
        expect(blocked).toHaveTextContent("Crédito bloqueado")
        expect(blocked).toHaveTextContent("Archivado")
        expect(blocked.firstElementChild).toHaveClass("opacity-70")
    })

    it("BOM leads with the version and keeps components and cost without product or yield", () => {
        render(<BomHarness />)
        const [active, archived] = cards("Listas de materiales")
        expect(active).toHaveTextContent("BOM v1")
        expect(active).not.toHaveTextContent("Caja impresa")
        expect(active).not.toHaveTextContent("CAJ-001")
        expect(active).not.toHaveTextContent("10 Cajas")
        expect(active).toHaveTextContent("3 componentes")
        expect(active).toHaveTextContent("Costo por u. de rendimiento")
        expect(active).toHaveTextContent("15.000")
        expect(archived).toHaveTextContent("BOM archivada")
        expect(archived).toHaveTextContent("Inactiva")
        expect(archived).not.toHaveTextContent("Bolsa")
        expect(archived.firstElementChild).toHaveClass("opacity-70")
    })

    it("Category shows the active product count and archives without a default Activo badge", () => {
        render(<CategoryHarness />)
        const [active, archived] = cards("Categorías")
        expect(active).toHaveTextContent("PAP")
        expect(active).toHaveTextContent("Productos")
        expect(active).toHaveTextContent("12")
        expect(active).not.toHaveTextContent("Activo")
        expect(archived).toHaveTextContent("Archivada")
        expect(archived.firstElementChild).toHaveClass("opacity-70")
    })

    it("Warehouse uses stocked-product and unit counts in the media footnote and footer", () => {
        render(<WarehouseHarness />)
        const [active, archived] = cards("Bodegas")
        expect(active).toHaveTextContent("WH-01")
        expect(active).toHaveTextContent("4 productos")
        expect(active).toHaveTextContent("Unidades")
        expect(active).toHaveTextContent("25")
        expect(active).not.toHaveTextContent("Activo")
        expect(archived).toHaveTextContent("Archivado")
        expect(archived.firstElementChild).toHaveClass("opacity-70")
    })

    it("Group uses the compact document variant with the identity icon on the leading rail", () => {
        render(<GroupHarness />)
        const [group] = cards("Grupos")
        expect(group).toHaveTextContent("Ventas")
        expect(group).toHaveTextContent("Miembros")
        expect(group).toHaveTextContent("5")
        expect(group.querySelector(".h-20")).toBeNull()
        const rail = group.querySelector('[aria-hidden="true"].w-14')
        expect(rail).toHaveClass("border-r")
        expect(rail).not.toHaveClass("order-last")
        expect(rail).not.toHaveClass("border-l")
    })
})
